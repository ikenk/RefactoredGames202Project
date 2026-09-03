import { RenderManager } from '@/managers/types/RenderManager'
import { Material } from '@/materials/Material'
import { Mesh } from '@/objects/Mesh'
import { Shader } from '@/shaders/Shader'
import { mat3, mat4 } from 'gl-matrix'
import { PerspectiveCamera } from 'three'
import { FrameContext } from './types/FrameContext'
import { MeshValidationError } from '@/errors/EngineError/MeshError/MeshValidationError'
import { Uniforms } from '@/materials/types/Material'

export abstract class BaseRenderer {
  static idCount = 0 // 当前 BaseRenderer 对象的编号计数器，保证 id 和 name 的唯一性
  private id: number // 当前 BaseRenderer 对象的编号，保证 name 的唯一性

  public readonly gl: WebGLRenderingContext

  /** 调试标识：区分不同 renderer 实例 */
  public readonly name: string

  public readonly mesh: Mesh
  public material: Material
  protected shader: Shader

  /** 是否投射阴影（shadow pass 会渲染这个物体的深度） */
  private _castShadow: boolean = true
  /** 是否接收阴影（main pass 会采样 shadow map） */
  private _receiveShadow: boolean = true

  protected drawMode: GLenum
  protected engineUniformLocations: Map<string, WebGLUniformLocation | null> = new Map()

  private static readonly ENGINE_UNIFORMS = [
    'uModelMatrix',
    'uViewMatrix',
    'uProjectionMatrix',
    'uCameraPos',
    'uNormalMatrix'
  ] as const

  private managers: Map<string, RenderManager> = new Map()

  // 如果用户通过 GUI 动态切换 renderer.castShadow = false，
  // WebGLRenderer 中的
  // private shadowCasters: Set<BaseRenderer> = new Set()
  // private shadowReceivers: Set<BaseRenderer> = new Set()
  // 里的数据就过时了。需要一个方法来做同步（暂时不知道是否需要）
  onShadowFlagChanged?: (renderer: BaseRenderer) => void

  constructor(
    gl: WebGLRenderingContext,
    mesh: Mesh,
    material: Material,
    shader: Shader,
    drawMode: GLenum,
    name: string
  ) {
    this.id = BaseRenderer.idCount++ // 与 C++ 一致，等价于 this.id = BaseRenderer.idCount & BaseRenderer.idCount++

    this.gl = gl

    this.mesh = mesh
    this.material = material
    this.shader = shader

    this.drawMode = drawMode

    this.name = `${name}#${this.id}`

    // 校验索引数量与 drawMode 是否匹配
    BaseRenderer.validateIndexCount(gl, mesh.count, drawMode, mesh.name)

    // 初始化流程（顺序重要）
    this.mesh.createVBOs(gl) // 1. 数据 → GPU
    this.mesh.cacheAttriLocations(shader) // 2. 缓存 attribute locations
    this.material.cacheUniformLocations(shader) // 3. 缓存 uniform locations
    this.cacheEngineUniformLocations() // 4. MVP matrix + camera locations cache
  }

  // 校验索引数量与 drawMode 是否匹配
  private static validateIndexCount(
    gl: WebGLRenderingContext,
    count: number,
    drawMode: GLenum,
    meshName: string
  ) {
    if (drawMode === gl.TRIANGLES) {
      if (count % 3 !== 0) {
        throw new MeshValidationError(
          'invalid_index_count',
          `TRIANGLES requires index count divisible by 3, got ${count}`,
          meshName
        )
      }
    } else if (drawMode === gl.LINES) {
      if (count % 2 !== 0) {
        throw new MeshValidationError(
          'invalid_index_count',
          `LINES requires index count divisible by 2, got ${count}`,
          meshName
        )
      }
    } else if (drawMode === gl.LINE_STRIP || drawMode === gl.LINE_LOOP) {
      if (count < 2) {
        throw new MeshValidationError(
          'invalid_index_count',
          `LINE_STRIP/LINE_LOOP requires at least 2 indices, got ${count}`,
          meshName
        )
      }
    }
    // 其他模式（TRIANGLE_STRIP, TRIANGLE_FAN 等）：暂不校验
  }

  // ============================================================
  //  castShadow &  receiveShadow 管理
  // ============================================================
  get castShadow(): boolean {
    return this._castShadow
  }
  set castShadow(value) {
    if (this._castShadow === value) return
    this._castShadow = value
  }

  get receiveShadow(): boolean {
    return this._receiveShadow
  }

  set receiveShadow(value) {
    if (this._receiveShadow === value) return
    this._receiveShadow = value
  }

  // ============================================================
  //  RenderManager 管理
  // ============================================================
  addManager(manager: RenderManager) {
    if (this.managers.has(manager.name)) {
      console.warn(`[BaseRenderer] RenderManager '${manager.name}' already attached, skipping.`)
      return
    }
    this.managers.set(manager.name, manager)
  }

  removeManager(name: string): RenderManager | null {
    const manager = this.managers.get(name) ?? null
    this.managers.delete(name)
    return manager
  }

  getManager<T extends RenderManager>(name: string): T | null {
    return (this.managers.get(name) as T) ?? null
  }

  // ============================================================
  //  引擎级 Uniform
  // ============================================================
  private cacheEngineUniformLocations(): void {
    this.engineUniformLocations.clear()
    for (const name of BaseRenderer.ENGINE_UNIFORMS) {
      const location = this.shader.getUniformLocation(name)
      this.engineUniformLocations.set(name, location)
    }
  }

  protected bindCameraParameters(camera: PerspectiveCamera): void {
    const gl = this.gl

    // Model Matrix
    const modelMatrix = this.mesh.getModelMatrix()

    // View Matrix
    const viewMatrix = mat4.create()
    camera.updateMatrix()
    mat4.invert(viewMatrix, camera.matrixWorld.elements)

    // Project Matrix
    const projectionMatrix = mat4.create()
    mat4.copy(projectionMatrix, camera.projectionMatrix.elements)

    // Normal Matrix -- model coords => world coords
    const normalMatrix = mat3.create()
    mat3.fromMat4(normalMatrix, modelMatrix)
    mat3.invert(normalMatrix, normalMatrix)
    mat3.transpose(normalMatrix, normalMatrix)

    //  locations
    const locs = this.engineUniformLocations
    const uModelMatrix = locs.get(BaseRenderer.ENGINE_UNIFORMS[0])
    const uViewMatrix = locs.get(BaseRenderer.ENGINE_UNIFORMS[1])
    const uProjectionMatrix = locs.get(BaseRenderer.ENGINE_UNIFORMS[2])
    const uCameraPos = locs.get(BaseRenderer.ENGINE_UNIFORMS[3])
    const uNormalMatrix = locs.get(BaseRenderer.ENGINE_UNIFORMS[4])
    // 验证 location 是否存在，若存在，则给 uniform 赋值
    if (uModelMatrix) {
      gl.uniformMatrix4fv(uModelMatrix, false, modelMatrix)
    }
    if (uViewMatrix) {
      gl.uniformMatrix4fv(uViewMatrix, false, viewMatrix)
    }
    if (uProjectionMatrix) {
      gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix)
    }
    if (uCameraPos) {
      gl.uniform3fv(uCameraPos, [camera.position.x, camera.position.y, camera.position.z])
    }
    if (uNormalMatrix) {
      gl.uniformMatrix3fv(uNormalMatrix, false, normalMatrix)
    }
  }

  // ============================================================
  //  Material Uniform
  // ============================================================

  /**
   * 批量更新 Material 的 uniform 值（只改 JS 数据，不写 GPU）
   *
   * 典型用途：WebGLRenderer 在每帧开始时把 uTime、uLightVP 等推送给各材质
   */
  updateMaterialUniforms(uniforms?: Uniforms): void {
    if (!uniforms) return
    for (const [k, newEntry] of Object.entries(uniforms)) {
      if (!newEntry) continue

      const existing = this.material.uniforms[k]
      if (existing) {
        // 已存在：只更新 value
        existing.value = newEntry.value
      } else {
        // 不存在：新增整个 entry
        this.material.uniforms[k] = newEntry
        // 新增的 uniform 需要补缓存 location
        this.material.cacheUniformLocation(this.shader, k)
      }
    }

    // 不如上面的效率高
    // for (const k in this.material.uniforms) {
    //   if (k in values && this.material.uniforms[k]) {
    //     // TypeScript 不允许把 unknown 赋值给一个联合类型（因为它不知道你给的是对的类型还是错的类型）。never 是 TypeScript 中所有类型的子类型（bottom type），任何类型都可以接受 never 的赋值。
    //     // 因此，as never 解决了 「不能将类型“unknown”分配给类型“number | Int32Array<ArrayBufferLike> | number[] | Float32Array<ArrayBufferLike> | WebGLTexture | null”。」的错误
    //     this.material.uniforms[k].value = values[k] as never
    //   }
    // }
  }

  // ============================================================
  //  主渲染管线
  // ============================================================
  /**
   * 绘制一个 Mesh，但不选择输出目标。
   *
   * 输出目标已经由当前 RenderPass 的 RenderTargetScope 建立。
   * 这使一组 Mesh 可以共享同一个 pass 级目标，而不是每个 draw 重复 bind/unbind。
   *
   * 和 three.js 的联系：
   * three.js 的 WebGLRenderer 也先建立 render target，再执行对象绘制；
   * Mesh/Material 不通过一个 FBO 参数决定像素写向哪里。
   */
  draw(context: FrameContext, camera: PerspectiveCamera): void {
    const gl = this.gl

    // ① 渲染前计算。manager 读取本帧数据，但不能切换 RenderTarget。
    for (const manager of this.managers.values()) {
      manager.update(context)
    }

    // ② Shader
    this.shader.use()

    // ③ 几何数据。VAO 仍按当前 program 绑定。
    this.mesh.bind(this.shader)

    // ④ 引擎 uniform
    this.bindCameraParameters(camera)

    /**
     * ⑤ 材质 uniform。
     *
     * 纹理单元只需在本次材质绑定内从 0 开始；
     * 不使用 FrameContext.textureUnitCounter 做跨 renderer 全局累加。
     */
    this.material.applyUniforms(gl, this.shader, 0)

    // ⑥ Draw。它写入哪个 framebuffer，完全取决于外层 pass 已建立的作用域。
    if (this.mesh.hasIndices) {
      gl.drawElements(this.drawMode, this.mesh.count, this.mesh.indexData!.type, 0)
    } else {
      gl.drawArrays(this.drawMode, 0, this.mesh.count)
    }

    /**
     * ⑦ 只恢复本方法自己负责的 VAO。
     *
     * 这里不再 gl.bindFramebuffer(null)。BaseRenderer 没有建立 framebuffer
     * 作用域，因此也没有资格结束它。
     */
    this.mesh.unbind()
  }

  // ============================================================
  //  HUD 渲染
  // ============================================================

  /**
   * 以 HUD 方式渲染屏幕角落的坐标轴等内容，但不选择输出目标。
   *
   * WebGLRenderer.render() 已经为 Overlay 建立默认 framebuffer 作用域；
   * 本方法只临时改变 viewport 和 depth-test 状态，不能自行绑定 null framebuffer。
   * 如果未来 Overlay 渲染到其他 RenderTarget，也应由 OverlayRenderPass 声明目标。
   *
   * 和 three.js 的联系：
   * three.js 在 renderer/pass 层选择 render target；单个可绘制对象只提交绘制命令。
   *
   * 其内部会：
   * 1. 保存当前 viewport
   * 2. 设置小视口 (position × viewport → 像素坐标)
   * 3. 禁用深度测试
   * 4. 用正交投影 + 纯旋转视图矩阵
   * 5. 绘制
   * 6. 恢复 viewport 和深度测试
   */
  renderAsHUD(
    camera: PerspectiveCamera,
    context: FrameContext,
    hudPosition: { x: number; y: number },
    hudSize: number = 100
  ): void {
    const gl = this.gl

    // 保存当前视口（Int32Array [x, y, width, height]）
    const currentViewport = gl.getParameter(gl.VIEWPORT) as Int32Array
    const vpX = currentViewport[0] ?? 0
    const vpY = currentViewport[1] ?? 0
    const vpW = currentViewport[2] ?? gl.canvas.width
    const vpH = currentViewport[3] ?? gl.canvas.height

    // HUD 视口位置
    const screenX = hudPosition.x * vpW
    const screenY = hudPosition.y * vpH
    gl.viewport(screenX, screenY, hudSize, hudSize)
    gl.disable(gl.DEPTH_TEST)

    this.shader.use()
    // this.mesh.bind(gl)
    this.mesh.bind(this.shader) // 同 draw()：VAO 按 program 区分
    this.bindHUDCameraParameters(camera)
    // context.textureUnitCounter = this.material.applyUniforms(
    //   gl,
    //   this.shader,
    //   context.textureUnitCounter
    // )
    context.textureUnitCounter = this.material.applyUniforms(gl, this.shader, 0)
    if (this.mesh.hasIndices) {
      gl.drawElements(this.drawMode, this.mesh.count, this.mesh.indexData!.type, 0)
    } else {
      gl.drawArrays(this.drawMode, 0, this.mesh.count)
    }

    this.mesh.unbind() // 同 draw()：回到默认 VAO
    gl.enable(gl.DEPTH_TEST)
    gl.viewport(vpX, vpY, vpW, vpH)
  }

  private bindHUDCameraParameters(camera: PerspectiveCamera): void {
    const gl = this.gl

    const modelMatrix = mat4.create()
    mat4.identity(modelMatrix)

    const viewMatrix = mat4.create()
    camera.updateMatrixWorld()
    mat4.invert(viewMatrix, camera.matrixWorld.elements)
    viewMatrix[12] = 0 // 清除平移，只保留旋转
    viewMatrix[13] = 0
    viewMatrix[14] = 0

    const projectionMatrix = mat4.create()
    const size = 0.1
    mat4.ortho(projectionMatrix, -size, size, -size, size, -size, size)

    const loc = this.engineUniformLocations
    const uModel = loc.get('uModelMatrix')
    const uView = loc.get('uViewMatrix')
    const uProjection = loc.get('uProjectionMatrix')
    const uCameraPos = loc.get('uCameraPos')

    if (uModel) gl.uniformMatrix4fv(uModel, false, modelMatrix)
    if (uView) gl.uniformMatrix4fv(uView, false, viewMatrix)
    if (uProjection) gl.uniformMatrix4fv(uProjection, false, projectionMatrix)
    if (uCameraPos) gl.uniform3fv(uCameraPos, [0, 0, 0])
  }

  // ============================================================
  //  清理
  // ============================================================

  dispose() {
    for (const manager of this.managers.values()) {
      manager.dispose?.()
    }
    this.managers.clear()
    this.mesh.dispose()
    this.shader.dispose()
  }
}
