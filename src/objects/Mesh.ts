import { Shader } from '@/shaders/Shader'
import { mat4, quat } from 'gl-matrix'
import { WebGLExtensionError } from '@/errors/EngineError/WebGLError/WebGLExtensionError'
import { Transform } from './utils/Transform'
import { MeshValidationError } from '@/errors/EngineError/MeshError/MeshValidationError'
import { CubeGeometry } from '@/geometry/CubeGeometry'
import { MeshLocationCacheError } from '@/errors/EngineError/MeshError/MeshLocationCacheError'
import { MeshVBOCreationError } from '@/errors/EngineError/MeshError/MeshVBOCreationError'
import { SphereGeometry } from '@/geometry/SphereGeometry'
import { AttributeData, IndexData, TypedArrayType } from './types/Mesh'
import { ExhaustiveMatchError } from '@/errors/LanguageError/ExhaustiveMatchError'
import { getCapabilities } from '@/_config/glCapabilities'
import { MeshVAOCreationError } from '@/errors/EngineError/MeshError/MeshVAOCreationError'

// ============================================================
//  Mesh 类（管理几何数据、VBO、attribute locations）
// ============================================================
export class Mesh {
  static idCount = 0 // 当前 Mesh 对象的编号计数器，保证 id 和 name 的唯一性
  private id: number // 当前 Mesh 对象的编号，保证 name 的唯一性

  protected gl: WebGLRenderingContext

  public readonly name: string

  public readonly attributes: Map<string, AttributeData> = new Map()
  public readonly indexData: IndexData | null

  private _transform: Transform

  // Mesh 自己管理 VBO
  private vbos: Map<string, WebGLBuffer> = new Map()
  private ibo: WebGLBuffer | null = null

  // Mesh 自己缓存 attribute locations
  //   问题：它只有 (attribute 名) 一个维度，隐含假设「一个 Mesh 只被一个 program 绘制」。
  //   而 ShadowPass.ts:70 和 FFTOceanComputePass-multi-layers-v3.ts:76-80 都违反了这个假设。
  // private locationCache: Map<string, number> = new Map()

  /** 每个 shader program 一个 VAO —— 补上了 program 这一维 */
  private vaos: Map<WebGLProgram, WebGLVertexArrayObjectOES> = new Map()

  /** 每个 program 一份 name → location，仅供调试查询 */
  private locationCaches: Map<WebGLProgram, Map<string, number>> = new Map()

  /**
   * VAO 扩展。
   * 走 glCapabilities 统一取（那里已经是「集中调 getExtension」的唯一入口），
   * 缺失时 fail-fast —— 与 chooseIndexType 对 OES_element_index_uint 的处理一致。
   */
  private get vaoExt(): OES_vertex_array_object {
    const ext = getCapabilities().vertexArrayObject
    if (!ext) throw new WebGLExtensionError('OES_vertex_array_object')
    return ext
  }

  // ----- constructor -----
  constructor(
    attributes: AttributeData[],
    rawIndices: number[] | Uint8Array | Uint16Array | Uint32Array | null,
    transform: Transform,
    name: string,
    gl: WebGLRenderingContext
  ) {
    // 对传入数据的进行检查
    if (attributes.length === 0) {
      throw new MeshValidationError('empty_attribute', 'No attributes provided', name)
    }

    // 此处硬编码了三角形的假设，但 Mesh 不应该知道自己会被怎么画。比如 Axis Mesh 总共有 3 个轴，每个轴 2 个点，每个点对应 1 个 index，一共 6 个 index，但这仅是恰巧能被 3 整除。因此，对 rawIndices.length 的检查不应放在 Mesh 的构造函数中， Mesh 不应该知道自己会被怎么画。
    // if (rawIndices.length % 3 !== 0) {
    //   throw new MeshValidationError(
    //     'invalid_index_count',
    //     `Index count (${rawIndices.length}) is not a multiple of 3`,
    //     name
    //   )
    // }

    this.id = Mesh.idCount++ // 与 C++ 一致，等价于 this.id = Mesh.idCount & Mesh.idCount++

    this.gl = gl

    for (const attri of attributes) {
      this.attributes.set(attri.name, attri)
    }

    // 索引可选
    this.indexData =
      rawIndices && rawIndices.length > 0 ? Mesh.chooseIndexType(rawIndices, gl) : null

    this._transform = transform

    // 如果未来打包后 Mesh 这个类名变成了 a 怎么办？那 name 是不是也就跟着变成了 a ？
    // this.name = this.constructor.name
    this.name = `${name}#${this.id}`
  }

  // ----- chooseIndexType -----
  /**
   * 一个纯粹的数据转换工具
   *
   * 将普通的 number[] 转换为 {@linkcode IndexData | 索引缓冲数据类型}。
   * 该函数不涉及 GPU 操作，仅进行数据结构转换。
   */
  private static chooseIndexType(
    indices: number[] | Uint8Array | Uint16Array | Uint32Array,
    gl: WebGLRenderingContext
  ): IndexData {
    // 使用 ... 展开运算符时，在 V8 里，大致会做：
    // 1. 创建一个 arguments list
    // 2. 遍历 indices
    // 3. 把每个元素“放进调用栈参数区”
    // 因此，当 indices 元素太多时会造成 RangeError: Maximum call stack size exceeded 错误
    // const maxIndex = Math.max(...indices)

    if (Array.isArray(indices)) {
      let maxIndex = -Infinity
      for (let i = 0; i < indices.length; i++) {
        if (indices[i]! > maxIndex) {
          maxIndex = indices[i]!
        }
      }

      // for (const index of indices) {
      //   if (index > maxIndex) {
      //     maxIndex = index
      //   }
      // }

      if (maxIndex < 256) {
        return { array: new Uint8Array(indices), type: gl.UNSIGNED_BYTE }
      }
      if (maxIndex < 65536) {
        return { array: new Uint16Array(indices), type: gl.UNSIGNED_SHORT }
      }

      const ext = gl.getExtension('OES_element_index_uint')
      if (!ext) throw new WebGLExtensionError('OES_element_index_uint')

      return {
        array: new Uint32Array(indices),
        type: gl.UNSIGNED_INT
      }
    } else if (ArrayBuffer.isView(indices)) {
      if (indices instanceof Uint8Array) {
        return { array: indices, type: gl.UNSIGNED_BYTE }
      }
      if (indices instanceof Uint16Array) {
        return { array: indices, type: gl.UNSIGNED_SHORT }
      }
      if (indices instanceof Uint32Array) {
        const ext = gl.getExtension('OES_element_index_uint')
        if (!ext) throw new WebGLExtensionError('OES_element_index_uint')
        return {
          array: indices,
          type: gl.UNSIGNED_INT
        }
      }
    }

    throw new ExhaustiveMatchError(indices, 'Invalid indices type')
  }

  // ============================================================
  //  GPU 资源：VBO / IBO
  // ============================================================

  /**
   * 创建 VBO（由 Mesh 负责），并写入数据
   *
   * 仅负责分配并填充缓冲区数据，
   * 不会配置 attribute pointer 或定义数据读取方式。
   * attribute 的绑定与启用由 bind() 阶段完成。
   */
  createVBOs(gl: WebGLRenderingContext, dynamic: boolean = false): void {
    // ELEMENT_ARRAY_BUFFER 的绑定属于「当前 VAO」的状态。
    //   若此刻恰好绑着某个 Mesh 的 VAO，本方法末尾那句
    //   bindBuffer(ELEMENT_ARRAY_BUFFER, null) 会把那个 VAO 的索引缓冲清成 null，
    //   导致那个 Mesh 下次 drawElements 直接 INVALID_OPERATION。
    //   先回到默认 VAO，所有 buffer 绑定就只会落在那张没人绘制的表上。
    //   （ARRAY_BUFFER 的绑定不属于 VAO，不受影响。）
    this.vaoExt.bindVertexArrayOES(null)

    const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW

    // 临时 Map：array 对象引用 → 已创建的 VBO
    // 用来检测多个 attribute 是否共享同一份数据
    const uploadedArrays = new Map<TypedArrayType, WebGLBuffer>()

    // 创建 attribute buffers
    for (const [name, attriData] of this.attributes) {
      let vbo: WebGLBuffer

      if (uploadedArrays.has(attriData.array)) {
        // 这份数据已经上传过，直接复用同一个 VBO
        vbo = uploadedArrays.get(attriData.array)!
      } else {
        // 第一次见到这份数据，创建新 VBO 并上传
        vbo = gl.createBuffer()
        if (!vbo) {
          throw new MeshVBOCreationError('vbo', `Failed to create VBO for '${name}'`, this.name, {
            attributeName: name
          })
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
        gl.bufferData(gl.ARRAY_BUFFER, attriData.array, usage)
        uploadedArrays.set(attriData.array, vbo)
      }

      this.vbos.set(name, vbo)
    }

    // 索引缓冲 index buffer 仅在有索引时创建
    if (this.indexData) {
      this.ibo = gl.createBuffer()
      if (!this.ibo) {
        throw new MeshVBOCreationError('ibo', `Failed to create VBO for ${this.name}`, this.name)
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData.array, gl.STATIC_DRAW)
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }

  // ============================================================
  //  VAO
  // ============================================================

  /**
   * ★修改：方法名与签名保持不变（现有 10 处调用点无需改动），语义升级为
   *        「为这个 program 预先录制一份 VAO」。
   *
   * 原实现：this.locationCache.clear() 之后重填 —— 所以对同一个 Mesh 连续用不同
   *        shader 调用时，只有最后一次的结果留得下来（v3 的三连调用就是这样）。
   * 新实现：每个 program 各存各的，互不覆盖。
   *
   * 不调用也行，bind() 会在首次遇到新 program 时自动录制；
   * 建议在加载阶段调用，避免第一帧多花那几十微秒。
   */
  cacheAttriLocations(shader: Shader): void {
    this.ensureVAO(shader)
  }

  /**
   * ★修改：签名 bind(gl) → bind(shader)。
   *
   * 原实现每帧对全局唯一的默认 VAO 执行 N 次 bindBuffer + N 次 vertexAttribPointer +
   * N 次 enableVertexAttribArray，且只 enable 从不 disable —— 这是黑屏 bug 的根源。
   *
   * 新实现只做一件事：把这个 (Mesh, program) 的 VAO 设为当前 VAO。
   *
   * @param shader 必须与随后 useProgram 生效的那个一致。
   *               原实现无法保证这一点：ShadowPass 用 shadowShader 绘制，
   *               却使用按 directLightShader 缓存的 location（碰巧都是 0 才没出事）。
   */
  bind(shader: Shader): void {
    this.vaoExt.bindVertexArrayOES(this.ensureVAO(shader))
  }

  /**
   * ★新增：解绑，回到默认 VAO。建议每次 draw 之后调用。
   *
   * 代价是一次 GL 调用，收益是：那些绕过 Mesh 直接操作槽位的代码
   * （drawCube.ts / convertHDRToCubeMap.ts / FFTProcessor.ts）
   * 永远只会写到默认 VAO 上，碰不到任何 Mesh 的 VAO。
   */
  unbind(): void {
    this.vaoExt.bindVertexArrayOES(null)
  }

  /** ★新增：取出（必要时录制）该 program 的 VAO */
  private ensureVAO(shader: Shader): WebGLVertexArrayObjectOES {
    const existing = this.vaos.get(shader.program)
    if (existing) return existing
    return this.recordVAO(shader)
  }

  /**
   * ★新增：录制 VAO。
   *
   * bindVertexArrayOES(vao) 之后发出的 vertexAttribPointer / enableVertexAttribArray /
   * 绑 ELEMENT_ARRAY_BUFFER，全部只写进这个 vao，对默认 VAO 和其它 VAO 零影响。
   *
   * ❗ 注意与 createVBOs 的差别：这里在「停止录制」之前**不会**把
   *    ELEMENT_ARRAY_BUFFER 置 null —— 那正是要录进 VAO 的东西。
   */
  private recordVAO(shader: Shader): WebGLVertexArrayObjectOES {
    const gl = this.gl
    const ext = this.vaoExt

    const vao = ext.createVertexArrayOES()
    if (!vao) {
      throw new MeshVAOCreationError(`Failed to create VAO for '${this.name}'`, this.name, {
        shaderName: shader.name
      })
    }

    const locations = new Map<string, number>()
    const skipped: string[] = []

    ext.bindVertexArrayOES(vao) // 开始录制

    for (const [name, vbo] of this.vbos) {
      const location = shader.getAttribLocation(name)
      if (location < 0) {
        // -1 是合法常态：mesh 带了这个 attribute 但该 shader 没声明。
        // 例如 ball.gltf 有 aTangent，而 Cook-Torrance / Kulla-Conty 没有。
        skipped.push(name)
        continue
      }

      const attriData = this.attributes.get(name)
      if (!attriData) {
        ext.bindVertexArrayOES(null)
        ext.deleteVertexArrayOES(vao)
        throw new MeshValidationError(
          'empty_attribute',
          `VBO exists for attribute '${name}' but AttributeData is missing`,
          this.name
        )
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.vertexAttribPointer(
        location,
        attriData.size,
        attriData.type,
        attriData.normalized ?? false,
        attriData.stride ?? 0,
        attriData.offset ?? 0
      )
      gl.enableVertexAttribArray(location)
      locations.set(name, location)
    }

    // 索引缓冲的绑定同样是 VAO 状态，一并录进去（录完不清空，见方法头注释）
    if (this.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)

    ext.bindVertexArrayOES(null) // 停止录制
    gl.bindBuffer(gl.ARRAY_BUFFER, null) // ARRAY_BUFFER 不属于 VAO，顺手清干净

    if (locations.size === 0) {
      // 一个都没对上 —— 基本可断定传错了 shader，属于真错误
      console.warn(
        new MeshLocationCacheError(
          [...this.vbos.keys()].join(', '),
          `No attribute of '${this.name}' matched shader '${shader.name}'. Wrong shader?`,
          this.name,
          { shaderProgramName: shader.name }
        )
      )
    } else if (skipped.length > 0) {
      // 部分未命中是正常的，从 console.warn 降级为 console.debug 并合并成一条，
      // 避免 HW4 那种「20 条 aTangent 警告刷屏」
      //       console.debug(
      //         `[Mesh '${this.name}'] attributes not used by '${shader.name}': ${skipped.join(', ')}`
      //       )
    }

    this.vaos.set(shader.program, vao)
    this.locationCaches.set(shader.program, locations)
    return vao
  }

  /**
   * 作废所有已录制的 VAO（下次 bind 时重新录）。
   *
   * 何时需要：VBO 被**换成新的 buffer 对象**时。
   * 只是往同一个 buffer 对象里 bufferData / bufferSubData 写新数据**不需要**调用它
   * —— VAO 记的是 buffer 对象引用，内容变了不影响。
   */
  invalidateVAOs(): void {
    const ext = this.vaoExt
    ext.bindVertexArrayOES(null) // 先解绑，避免删掉当前绑定的对象
    for (const vao of this.vaos.values()) ext.deleteVertexArrayOES(vao)
    this.vaos.clear()
    this.locationCaches.clear()
  }

  /**
   * 缓存 attribute locations（由 Mesh 负责）
   *
   * 仅进行 attribute 名称到 location 的映射查询，
   * 不涉及缓冲区数据的上传或绑定。
   */
  // cacheAttriLocations(shader: Shader): void {
  //   this.locationCache.clear()

  //   for (const name of this.attributes.keys()) {
  //     const location = shader.getAttribLocation(name)
  //     if (location >= 0) {
  //       this.locationCache.set(name, location)
  //     } else {
  //       console.warn(
  //         new MeshLocationCacheError(
  //           name,
  //           `Attribute '${name}' not found in '${shader.name}' shader program`,
  //           this.name,
  //           {
  //             shaderProgramName: shader.name
  //           }
  //         )
  //       )
  //     }
  //   }
  // }

  /**
   * 获取 attribute location（从缓存）
   *
   * 配置 attribute pointer 并启用 attribute，
   * 指定 GPU 如何解释已上传的缓冲区数据。
   *
   * 不会执行数据上传操作。
   */
  // getAttriLocation(name: string): number | undefined {
  //   return this.locationCache.get(name)
  // }
  /** 加了 shader 参数（location 本来就是 (name, program) 的二元映射） */
  getAttriLocation(name: string, shader: Shader): number | undefined {
    return this.locationCaches.get(shader.program)?.get(name)
  }

  /**
   * 绑定几何数据（由 Mesh 负责）
   */
  // bind(gl: WebGLRenderingContext) {
  //   // console.debug(this.vbos.size)
  //   // console.debug(this.locationCache.size)

  //   for (const [name, vbo] of this.vbos) {
  //     const location = this.getAttriLocation(name)
  //     if (location === undefined || location < 0) continue

  //     const attriData = this.attributes.get(name)
  //     if (!attriData) {
  //       throw new MeshValidationError(
  //         'empty_attribute',
  //         `VBO exists for attribute '${name}' but AttributeData is missing`,
  //         this.constructor.name
  //       )
  //     }

  //     gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  //     gl.vertexAttribPointer(
  //       location,
  //       attriData.size,
  //       attriData.type,
  //       attriData.normalized ?? false,
  //       attriData.stride ?? 0,
  //       attriData.offset ?? 0
  //     )
  //     gl.enableVertexAttribArray(location)
  //   }

  //   // 绑定索引
  //   if (this.ibo) {
  //     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)
  //   }
  // }

  // ============================================================
  //  变换 / 查询
  // ============================================================

  /**
   * 获取 Model 矩阵
   */
  getModelMatrix(): mat4 {
    const matrix = mat4.create()
    mat4.identity(matrix)

    const q = quat.create()
    quat.identity(q) // 显式设为单位四元数（create() 已经是这个值，这行多余）

    // gl-matrix 提供了从欧拉角直接创建四元数的方法
    quat.fromEuler(
      q,
      this._transform.rotation[0] * (180 / Math.PI), // fromEuler 接受角度，不是弧度
      this._transform.rotation[1] * (180 / Math.PI),
      this._transform.rotation[2] * (180 / Math.PI)
    )

    /**
     * transform.rotate 存的是欧拉角（XYZ 三个独立角度），
     * 把它们分别转成四元数再合并。
     * 这样做绕了一个大圈，但并没有解决欧拉角的本质问题（万向节死锁），只是换了一种计算方式，
     * 结果完全等价于直接用欧拉角。
     */
    // const qx = quat.create()
    // const qy = quat.create()
    // const qz = quat.create()
    // quat.setAxisAngle(qx, [1, 0, 0], this.transform.rotate[0])
    // quat.setAxisAngle(qy, [0, 1, 0], this.transform.rotate[1])
    // quat.setAxisAngle(qz, [0, 0, 1], this.transform.rotate[2])
    // 顺序非常重要（和原来的 rotateX/Y/Z 一致）
    // quat.multiply(q, q, qx)
    // quat.multiply(q, q, qy)
    // quat.multiply(q, q, qz)
    // mat4.fromQuat(matrix, q)

    // mat4.translate(matrix, matrix, this.transform.translate)
    // mat4.scale(matrix, matrix, this.transform.scale)
    // mat4.rotateX(matrix, matrix, this.transform.rotate[0])
    // mat4.rotateY(matrix, matrix, this.transform.rotate[1])
    // mat4.rotateZ(matrix, matrix, this.transform.rotate[2])

    mat4.fromRotationTranslationScale(matrix, q, this._transform.translation, this._transform.scale)

    return matrix
  }

  // 修改 translate
  setTranslation(x: number, y: number, z: number): void {
    this._transform.setTranslation([x, y, z])
  }

  // 修改 scale
  setScale(x: number, y: number, z: number): void {
    this._transform.setScale([x, y, z])
  }

  // 修改 rotate（弧度）
  setRotation(x: number, y: number, z: number): void {
    this._transform.setRotation([x, y, z])
  }

  get transform(): Transform {
    return this._transform
  }

  /** 是否使用索引绘制 */
  get hasIndices(): boolean {
    return this.indexData !== null
  }

  // 获取 indices 个数
  get count(): number {
    if (this.indexData) {
      return this.indexData.array.length
    }
    // 无索引时，用 aPosition 的数据长度 / itemSize 算出顶点数
    const posAttr = this.attributes.get('aPosition')
    if (posAttr) {
      return posAttr.array.length / posAttr.size
    }
    // fallback：取第一个 attribute
    const first = this.attributes.values().next().value
    return first ? first.array.length / first.size : 0
  }

  // ============================================================
  //  清理
  // ============================================================

  /** 清理 */
  dispose() {
    const gl = this.gl
    // ★新增 —— 顺序至关重要：
    //   VAO 删掉之后，就不存在任何「还引用着这些 buffer 的顶点属性状态」，
    //   下面的 deleteBuffer 便不可能再在别人的状态里留下 enabled + null 的空洞。
    //   旧实现的黑屏 bug 正是死在这一步（buffer 删了，别人的 enabled 还开着）。
    this.invalidateVAOs()

    /**
     * 需要清除的属性
     *
     * private vbos: Map<string, WebGLBuffer> = new Map()
     * private ibo: WebGLBuffer | null = null
     * private locationCache: Map<string, number> = new Map()
     */
    // 多个 attribute 可能共享同一个 VBO（interleaved），去重后再删
    const deletedVBOs: Set<WebGLBuffer> = new Set()
    for (const vbo of this.vbos.values()) {
      // 需要考虑多个 attribute 共享同一个 VBO（Interleaved）的情况，最好不要对同一个 VBO 调用多次 gl.deleteBuffer()
      if (!deletedVBOs.has(vbo)) {
        deletedVBOs.add(vbo)
        gl.deleteBuffer(vbo)
      }
    }
    if (this.ibo) {
      gl.deleteBuffer(this.ibo)
      this.ibo = null
    }

    this.vbos.clear()
    // this.locationCache.clear()
  }

  // ============================================================
  //  内置几何体
  // ============================================================

  static cube(transform: Transform, gl: WebGLRenderingContext) {
    const geometry = CubeGeometry.create()

    return new Mesh(geometry.attributes, geometry.indices, transform, 'Cube', gl)
  }

  static sphere(transform: Transform, gl: WebGLRenderingContext) {
    const geometry = SphereGeometry.create(8, 16)

    return new Mesh(geometry.attributes, geometry.indices, transform, 'Sphere', gl)
  }
}
