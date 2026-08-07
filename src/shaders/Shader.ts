import { HttpError } from '@/errors/EngineError/NetworkError/HTTPError'
import { NetworkTimeoutError } from '@/errors/EngineError/NetworkError/NetworkTimeoutError'
import { ShaderLoadError } from '@/errors/EngineError/ShaderError/ShaderLoadError'
import { fetchTextWithTimeout } from '@/network/fetchText'
import { ShaderCode, ShaderFile, ShaderStage } from './types/Shader'
import { ShaderCreationError } from '@/errors/EngineError/ShaderError/ShaderCreationError'
import { ShaderCompilationError } from '@/errors/EngineError/ShaderError/ShaderCompilationError'
import { ShaderLinkError } from '@/errors/EngineError/ShaderError/ShaderLinkError'
import { mat4, vec2, vec3 } from 'gl-matrix'
import { Vec2, Vec3 } from '@/math/types/math'

// ============================================================
// Shader 类（只负责编译和工具方法）
// ============================================================
export class Shader {
  // 模块级缓存，所有 Shader 实例共享
  private static cache: Map<string, Shader> = new Map()

  // static cacheKey = ''

  private readonly gl: WebGLRenderingContext
  public readonly program: WebGLProgram

  public readonly name: string

  private constructor(gl: WebGLRenderingContext, program: WebGLProgram, name: string) {
    this.gl = gl
    this.program = program

    // this.name = this.constructor.name // 如果未来打包后 Mesh 这个类名变成了 a 怎么办？那 name 是不是也就跟着变成了 a ？
    this.name = name
  }

  /**
   * 工具方法：获取 attribute location
   */
  getAttribLocation(name: string): number {
    return this.gl.getAttribLocation(this.program, name)
  }

  /**
   * 工具方法：获取 uniform location
   */
  getUniformLocation(name: string): WebGLUniformLocation | null {
    return this.gl.getUniformLocation(this.program, name)
  }

  /** 通过 location 设置 mat4 uniform */
  setMat4ByLoc(location: WebGLUniformLocation, value: Float32Array | mat4) {
    this.gl.uniformMatrix4fv(location, false, value)
  }

  /** 通过 location 设置 vec3 uniform */
  setVec3ByLoc(location: WebGLUniformLocation, value: Float32Array | Vec3 | vec3): void {
    this.gl.uniform3fv(location, value)
  }

  /** 通过 location 设置 float uniform */
  set1fByLoc(location: WebGLUniformLocation, value: number): void {
    this.gl.uniform1f(location, value)
  }

  /** 通过 location 设置 int uniform */
  set1iByLoc(location: WebGLUniformLocation, value: number): void {
    this.gl.uniform1i(location, value)
  }

  /** 通过 location 设置 Texture2D uniform */
  setTexture2DByLoc(location: WebGLUniformLocation, value: WebGLTexture, unit: GLint): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, value)
    this.gl.uniform1i(location, unit)
  }

  /** 通过 location 设置 TextureCube uniform */
  setTextureCubeByLoc(location: WebGLUniformLocation, value: WebGLTexture, unit: GLint): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, value)
    this.gl.uniform1i(location, unit)
  }

  /** 通过名称设置 mat4 uniform */
  setMat4(name: string, value: Float32Array | mat4): void {
    const loc = this.getUniformLocation(name)
    if (!loc) {
      console.warn(`[Shader "${this.name}"] Uniform "${name}" not found, skipping`)
      return
    }
    this.gl.uniformMatrix4fv(loc, false, value)
  }

  /** 通过名称设置 float uniform */
  set1f(name: string, value: number): void {
    const loc = this.getUniformLocation(name)
    if (!loc) {
      console.warn(`[Shader "${this.name}"] Uniform "${name}" not found, skipping`)
      return
    }
    this.gl.uniform1f(loc, value)
  }

  /** 通过名称设置 int uniform */
  set1i(name: string, value: number): void {
    const loc = this.getUniformLocation(name)
    if (!loc) {
      console.warn(`[Shader "${this.name}"] Uniform "${name}" not found, skipping`)
      return
    }
    this.gl.uniform1i(loc, value)
  }

  /** 通过名称设置 vec2 uniform */
  setVec2(name: string, value: Float32Array | Vec2 | vec2) {
    const loc = this.getUniformLocation(name)
    if (!loc) {
      console.warn(`[Shader "${this.name}"] Uniform "${name}" not found, skipping`)
      return
    }
    this.gl.uniform2fv(loc, value)
  }

  /** 通过名称设置 vec3 uniform */
  setVec3(name: string, value: Float32Array | Vec3 | vec3): void {
    const loc = this.getUniformLocation(name)
    if (!loc) {
      console.warn(`[Shader "${this.name}"] Uniform "${name}" not found, skipping`)
      return
    }
    this.gl.uniform3fv(loc, value)
  }

  /** 通过名称绑定 texture_2D 到指定纹理单元 */
  setTexture2D(name: string, value: WebGLTexture, unit: GLint) {
    const loc = this.getUniformLocation(name)
    if (!loc) {
      console.warn(`[Shader "${this.name}"] Uniform "${name}" not found, skipping`)
      return
    }
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, value)
    this.gl.uniform1i(loc, unit)
  }

  /** 通过名称绑定 texture_cube_map 到指定纹理单元 */
  setTextureCube(name: string, value: WebGLTexture, unit: GLint) {
    const loc = this.getUniformLocation(name)
    if (!loc) {
      console.warn(`[Shader "${this.name}"] Uniform "${name}" not found, skipping`)
      return
    }
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, value)
    this.gl.uniform1i(loc, unit)
  }

  /** 激活程序 */
  use() {
    this.gl.useProgram(this.program)
  }

  /** 静态方法：工厂方法创建 Shader 实例 */
  static async createShader(
    gl: WebGLRenderingContext,
    vertexShaderPath: string,
    fragmentShaderPath: string
  ): Promise<Shader> {
    // 用 路径 + 名称 表示 cache key，因为同一套 shader 源码编译结果一定一样
    const filePath = vertexShaderPath.split('/').slice(0, -1).join('/')
    let fileName = vertexShaderPath.split('/').slice(-1)[0]?.split('.')[0]
    if (fileName?.includes('vert')) {
      fileName = vertexShaderPath.split('/').slice(-2, -1)[0]
    }

    // console.debug(fileName)

    const shaderName = `${filePath}/${fileName}-shader`

    // console.debug(shaderName)

    const cached = Shader.cache.get(shaderName)
    if (cached) {
      console.debug('cached')
      return cached
    }

    // console.debug(vertexShaderPath.split('/').slice(-2, -1))

    // 加载 ShaderFile -- shader code & shader path
    const shaderFile = await Shader.loadShaderFiles(vertexShaderPath, fragmentShaderPath)

    // 编译 shader
    const program = Shader.createProgram(gl, shaderFile)
    // 查看 shader program 中所有 active 的 attribute
    // const attribCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
    // for (let i = 0; i < attribCount; i++) {
    //   const info = gl.getActiveAttrib(program, i)
    //   console.debug(`attribute ${i}: ${info?.name}, type=${info?.type}, size=${info?.size}`)
    // }
    // 查看所有 active 的 uniform
    // const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
    // for (let i = 0; i < uniformCount; i++) {
    //   const info = gl.getActiveUniform(program, i)
    //   console.debug(`uniform ${i}: ${info?.name}, type=${info?.type}, size=${info?.size}`)
    // }

    const shader = new Shader(gl, program, shaderName)

    Shader.cache.set(shaderName, shader)
    return shader
  }

  /**
   * 静态方法：加载并字符串化 shader
   */
  private static async loadShaderFiles(
    vertexShaderPath: string,
    fragmentShaderPath: string
  ): Promise<ShaderFile> {
    const shaderCode: ShaderCode = {
      vShaderCode: '',
      fShaderCode: ''
    }

    // 加载顶点着色器
    try {
      shaderCode.vShaderCode = await fetchTextWithTimeout(vertexShaderPath)
    } catch (error) {
      throw Shader.wrapLoadError(error, 'vertex', vertexShaderPath)
    }

    // 加载片段着色器
    try {
      shaderCode.fShaderCode = await fetchTextWithTimeout(fragmentShaderPath)
    } catch (error) {
      throw Shader.wrapLoadError(error, 'fragment', fragmentShaderPath)
    }

    const shaderFile: ShaderFile = {
      ...shaderCode,
      vShaderPath: vertexShaderPath,
      fShaderPath: fragmentShaderPath
    }
    return shaderFile
  }

  /**
   * 静态方法：从代码编译并链接 shader
   */
  private static createProgram(gl: WebGLRenderingContext, shaderFile: ShaderFile): WebGLProgram {
    // 编译顶点着色器
    const vShader = gl.createShader(gl.VERTEX_SHADER)
    if (!vShader) throw new ShaderCreationError('vertex')
    gl.shaderSource(vShader, shaderFile.vShaderCode)
    gl.compileShader(vShader)

    if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
      throw new ShaderCompilationError(
        'vertex',
        shaderFile.vShaderPath,
        gl.getShaderInfoLog(vShader) ?? 'vertex shader compilation failed'
      )
    }

    // 编译片段着色器
    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    if (!fShader) throw new ShaderCreationError('fragment')
    gl.shaderSource(fShader, shaderFile.fShaderCode)
    gl.compileShader(fShader)

    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
      throw new ShaderCompilationError(
        'fragment',
        shaderFile.fShaderPath,
        gl.getShaderInfoLog(fShader) ?? 'fragment shader compilation failed'
      )
    }

    // 链接程序
    const program = gl.createProgram()
    gl.attachShader(program, vShader)
    gl.attachShader(program, fShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new ShaderLinkError(`${shaderFile.vShaderPath} & ${shaderFile.fShaderPath}`, 'program')
    }

    // 清理
    gl.deleteShader(vShader)
    gl.deleteShader(fShader)

    return program
  }

  /**
   * 包装 load 错误
   */
  private static wrapLoadError(error: unknown, shaderType: ShaderStage, shaderPath: string) {
    // HTTP 错误
    if (error instanceof HttpError) {
      return new ShaderLoadError(error.url, shaderType, {
        reason: `HTTP ${error.httpStatus}: ${error.statusText}`,
        statusCode: error.httpStatus
      })
    }

    // 超时错误
    if (error instanceof NetworkTimeoutError) {
      return new ShaderLoadError(error.url, shaderType, {
        reason: `Timeout after ${error.timeout}ms`,
        timeout: error.timeout
      })
    }

    // 其他错误
    return new ShaderLoadError(shaderPath, shaderType, {
      reason: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  /**
   * 清除 Shader cache
   */
  static clearCache(): void {
    for (const shader of Shader.cache.values()) {
      shader.dispose() // gl.deleteProgram()
    }
    Shader.cache.clear()
  }

  /** 清理 */
  dispose() {
    this.gl.deleteProgram(this.program)
    Shader.cache.delete(this.name)
  }
}
