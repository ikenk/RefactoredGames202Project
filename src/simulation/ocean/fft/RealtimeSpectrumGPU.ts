import { FBO } from '@/framebuffers/FBO'
import { Shader } from '@/shaders/Shader'
import { InitialSpectrum } from './InitialSpectrum'
import { FullScreenQuad } from '@/objects/FullScreenQuad'
import { ComplexBuffer } from './ComplexBuffer'
import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { FFTSpectrumEvolutionConfig } from './types/FFTSpectrumEvolutionConfig'

/**
 * GPU 实时频谱演化器
 *
 * 替换 CPU 端 src/simulation/ocean/fft/RealtimeSpectrum-v2.ts：
 *   - h0 / h0Conj 在构造期一次性上传成 Float32 RGBA 纹理
 *   - 每帧用一次 4-MRT draw call 完成 N×N 像素的频谱演化 + 四元打包
 *   - 输出 4 张 N×N RGBA-Float32 纹理（一个 FBO 的 4 个 attachment）
 *
 * 所有 cascade 层共享 1 个 shader、1 个 quad
 * @param fullScreenQuad 由 FFTOceanComputePass 持有、传入
 * @param shader 由 FFTOceanComputePass 持有、传入
 */
export class RealtimeSpectrumGPU {
  private gl: WebGLRenderingContext

  private readonly N: number
  private readonly L: number

  private readonly gravity: number

  private h0Texture: WebGLTexture
  private h0ConjTexture: WebGLTexture

  private outputFBO: FBO

  // 外部持有、传入、管理
  private fullScreenQuad: FullScreenQuad
  private shader: Shader

  constructor(
    gl: WebGLRenderingContext,
    // params: OceanParams,
    config: FFTSpectrumEvolutionConfig,
    initialSpectrum: InitialSpectrum,
    fullScreenQuad: FullScreenQuad,
    shader: Shader
  ) {
    this.gl = gl
    // this.N = params.fftResolution
    // this.L = params.size
    // this.gravity = params.gravity
    this.N = config.fftResolution
    this.L = config.size
    this.gravity = config.gravity
    this.fullScreenQuad = fullScreenQuad
    this.shader = shader

    this.h0Texture = this.uploadComplexBufferAsTexture(initialSpectrum.getH0())
    this.h0ConjTexture = this.uploadComplexBufferAsTexture(initialSpectrum.getH0Conj())

    this.outputFBO = new FBO(gl, {
      width: this.N,
      height: this.N,
      colorAttachmentCount: 4,
      colorTextureConfig: {
        internalFormat: gl.RGBA,
        format: gl.RGBA,
        type: gl.FLOAT,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE
      }
    })

    // ❌ 删掉这一行：
    // 原因：fullScreenQuad 是【外部传入、外部持有】的共享对象，
    //      它的 VBO 已经由 FFTOceanComputePass.create() 建好。
    //      这里再调一次会创建一套新 VBO 并直接覆盖 Mesh.vbos 里的引用，
    //      旧的那套永远删不掉。而 addLayer() 每层调用一次本构造函数，
    //      N 层 cascade 就泄漏 N 套 VBO。
    // this.fullScreenQuad.createVBOs(gl)

    // 保留：为本 pass 的 shader 预录制 VAO（与其它两个 shader 各自独立）
    this.fullScreenQuad.cacheAttriLocations(shader)
  }

  /**
   * 每帧调用。返回 4 个 attachment 的 WebGLTexture，供 IFFT 使用。
   * 不做 save/restore（调用方 execute() 在入口/出口统一处理）。
   */
  generateAtTime(time: number): [WebGLTexture, WebGLTexture, WebGLTexture, WebGLTexture] {
    const gl = this.gl

    this.outputFBO.bind()
    gl.viewport(0, 0, this.N, this.N)

    this.shader.use()

    this.shader.setTexture2D('uH0', this.h0Texture, 0)
    this.shader.setTexture2D('uH0Conj', this.h0ConjTexture, 1)
    this.shader.set1f('uTime', time)
    this.shader.set1f('uGravity', this.gravity)
    this.shader.set1f('uL', this.L)
    this.shader.set1f('uN', this.N)
    this.shader.set1f('uHalfN', this.N * 0.5)

    // this.fullScreenQuad.bind(gl)
    this.fullScreenQuad.bind(this.shader)
    gl.drawElements(gl.TRIANGLES, this.fullScreenQuad.count, this.fullScreenQuad.indexData!.type, 0)

    return [
      this.outputFBO.getTexture(0)!,
      this.outputFBO.getTexture(1)!,
      this.outputFBO.getTexture(2)!,
      this.outputFBO.getTexture(3)!
    ]
  }

  private uploadComplexBufferAsTexture(buffer: ComplexBuffer): WebGLTexture {
    const gl = this.gl

    const texture = gl.createTexture()
    if (!texture)
      throw new TextureCreationError('TEXTURE_2D', {
        reason: '[RealtimeSpectrumGPU] gl.createTexture failed'
      })
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.N,
      this.N,
      0,
      gl.RGBA,
      gl.FLOAT,
      buffer.toTextureData()
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

    return texture
  }

  /** GUI 改风速/方向 → 重传 h0/h0Conj，纹理对象保持复用 */
  rebuildFromInitialSpectrum(initialSpectrum: InitialSpectrum): void {
    this.updateComplexBufferTexture(this.h0Texture, initialSpectrum.getH0())
    this.updateComplexBufferTexture(this.h0ConjTexture, initialSpectrum.getH0Conj())
  }

  private updateComplexBufferTexture(texture: WebGLTexture, buffer: ComplexBuffer) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.N,
      this.N,
      0,
      gl.RGBA,
      gl.FLOAT,
      buffer.toTextureData()
    )
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteTexture(this.h0Texture)
    gl.deleteTexture(this.h0ConjTexture)
    this.outputFBO.dispose()
  }
}
