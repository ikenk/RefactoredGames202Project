import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { RenderPass } from '../types/RenderPass'
import { ComplexBuffer } from '@/simulation/ocean/fft/ComplexBuffer'
import { FBO } from '@/framebuffers/FBO'
import { RealtimeSpectrum } from '@/simulation/ocean/fft/RealtimeSpectrum-v1'
import { PhillipsSpectrum } from '@/simulation/ocean/spectrums/PhillipsSpectrum'
import { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'
import { Spectrum } from '@/simulation/ocean/spectrums/Spectrum'
import { InitialSpectrum } from '@/simulation/ocean/fft/InitialSpectrum'
import { FullScreenQuad } from '@/objects/FullScreenQuad'
import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { Uniforms, UniformType } from '@/materials/types/Material'

export interface LayerState {
  N: number
  size: number
  realtimeSpectrum: RealtimeSpectrum
  displacementFBO: FBO // [dispX, height, dispZ]     → 3 个 color attachment
  gradientFBO: FBO // [slopeX, slopeZ]           → 2 个 color attachment
  jacobianFBO: FBO // [dDx_dx, dDz_dz, dDx_dz, dDz_dx] → 4 个 color attachment
}

export class FFTOceanComputePass implements RenderPass {
  public readonly name = 'FFTOceanComputePass'

  // ---- GPU 端：IFFT 管线 ----
  private readonly gl: WebGLRenderingContext

  private pingFBOs: FBO[] = []
  private pongFBOs: FBO[] = []

  private layerStates: LayerState[] = []

  // 共享
  // Fullscreen quad（复用 Mesh 类）
  private fullscreenQuad: FullScreenQuad
  // Stockham FFT shader（水平 + 垂直 pass）
  private stockhamShader: Shader

  // ---- Receiver 管理（类似 ShadowRenderPass 的 casters/receivers）----
  private readonly receivers = new Set<BaseRenderer>()

  static async create(
    gl: WebGLRenderingContext,
    paramsCascade: OceanParams[],
    spectrum?: Spectrum
  ): Promise<FFTOceanComputePass> {
    const ctx = '[FFTOceanComputePass]'

    // ---- 共享部分 ----
    const stockhamShader = await Shader.createShader(
      gl,
      ShaderPaths.FFT_STOCKHAM_VERTEX,
      ShaderPaths.FFT_STOCKHAM_2D_FRAGMENT
    )

    const fullScreenQuad = new FullScreenQuad(gl, `FullScreenQuad<${ctx}>`)
    fullScreenQuad.createVBOs(gl)
    fullScreenQuad.cacheAttriLocations(stockhamShader)

    // ---- 创建 FFTOceanComputePass 实例 ----
    const pass = new FFTOceanComputePass(gl, fullScreenQuad, stockhamShader)

    // ---- 按照 paramsCascade 分层计算 ----
    for (const params of paramsCascade) {
      pass.addLayer(params, spectrum)
    }

    return pass
  }

  constructor(gl: WebGLRenderingContext, fullScreenQuad: FullScreenQuad, shader: Shader) {
    this.gl = gl

    // ---- 共享部分 ----
    this.fullscreenQuad = fullScreenQuad
    this.stockhamShader = shader
  }

  private addLayer(params: OceanParams, spectrum?: Spectrum) {
    const gl = this.gl

    const N = params.fftResolution
    const initialSpectrum = new InitialSpectrum(params, spectrum ?? new PhillipsSpectrum())
    const realtimeSpectrum = new RealtimeSpectrum(params, initialSpectrum)

    // Ping-pong FBO：4 个 color attachment（MRT，每个 attachment 存一个通道的 complex 数据）
    const pingpongTextureConfig = {
      type: gl.FLOAT, // 32 位浮点，支持负值和大范围
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE
    }
    const pingFBO = new FBO(gl, {
      width: N,
      height: N,
      colorAttachmentCount: 4,
      colorTextureConfig: pingpongTextureConfig
    })
    const pongFBO = new FBO(gl, {
      width: N,
      height: N,
      colorAttachmentCount: 4,
      colorTextureConfig: pingpongTextureConfig
    })

    this.pingFBOs.push(pingFBO)
    this.pongFBOs.push(pongFBO)

    // 输出 FBO：各 1 个 color attachment
    // 最终 Stockham stage（uFinalStage=true）将所有通道的 real 部分打包进 gl_FragData[0] 的 RGBA
    const renderOutTextureConfig = {
      internalFormat: gl.RGBA,
      format: gl.RGBA,
      type: gl.FLOAT,
      minFilter: gl.LINEAR_MIPMAP_LINEAR, // 理想情况
      magFilter: gl.LINEAR,
      wrapS: gl.REPEAT,
      wrapT: gl.REPEAT,
      generateMipmap: true
    }

    const displacementFBO = new FBO(gl, {
      width: N,
      height: N,
      colorAttachmentCount: 1,
      colorTextureConfig: renderOutTextureConfig
    })
    const gradientFBO = new FBO(gl, {
      width: N,
      height: N,
      colorAttachmentCount: 1,
      colorTextureConfig: renderOutTextureConfig
    })
    const jacobianFBO = new FBO(gl, {
      width: N,
      height: N,
      colorAttachmentCount: 1,
      colorTextureConfig: renderOutTextureConfig
    })

    const layState: LayerState = {
      N,
      size: params.size, // FFT 计算时的海面大小（区分于显示在屏幕上的海面 Mesh 的大小）
      realtimeSpectrum,
      displacementFBO,
      gradientFBO,
      jacobianFBO
    }

    this.layerStates.push(layState)
  }

  // ============================================================
  //  Receiver 管理
  // ============================================================

  /**
   * 添加接收 IFFT 输出纹理的 renderer
   *
   * 类似 ShadowRenderPass.addReceiver()：
   * execute() 完成后会对每个 receiver 调用 applyOutputTextures()
   */
  addReceiver(renderer: BaseRenderer): void {
    this.receivers.add(renderer)
    this.bindOutputTextures(renderer)
  }

  removeReceiver(renderer: BaseRenderer): void {
    this.receivers.delete(renderer)
  }

  /**
   * 一次性将输出 FBO 的纹理绑定到 renderer 的 material
   *
   * 纹理 handle 不变，内容由 IFFT 每帧更新，
   * Material.applyUniforms() 时会用 gl.bindTexture 绑定当前内容。
   */
  private bindOutputTextures(renderer: BaseRenderer): void {
    const uniforms: Uniforms = {}
    for (let i = 0; i < this.layerStates.length; i++) {
      const layerState = this.layerStates[i]!
      uniforms[`uDisplacementMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: layerState.displacementFBO.getTexture(0)!
      }
      uniforms[`uGradientMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: layerState.gradientFBO.getTexture(0)!
      }
      uniforms[`uDispDerivativeMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: layerState.jacobianFBO.getTexture(0)!
      }
      // layerSizes 数组
      uniforms[`uLayerSize${i}`] = {
        type: UniformType.ONE_F,
        value: layerState.size // FFT 计算时的海面大小（区分于显示在屏幕上的海面 Mesh 的大小）
      }
    }

    renderer.updateMaterialUniforms(uniforms)
  }

  // ============================================================
  //  RenderPass 接口
  // ============================================================

  execute(context: FrameContext, _camera: PerspectiveCamera): void {
    if (!this.stockhamShader || !this.fullscreenQuad) return

    for (let i = 0; i < this.layerStates.length; i++) {
      const layerState = this.layerStates[i]!
      const pingFBO = this.pingFBOs[i]!
      const pongFBO = this.pongFBOs[i]!
      // 1: CPU 端生成 9 个频域 ComplexBuffer（零 GC）
      const buffers = layerState.realtimeSpectrum.generateAtTime(context.elapsedTime)

      // console.debug(buffers)

      // 2: GPU IFFT（分 3 组，对应 3 个输出 FBO）
      this.computeGroup(
        [buffers.height, buffers.dispX, buffers.dispZ],
        layerState.displacementFBO,
        layerState.N,
        pingFBO,
        pongFBO
      )
      this.computeGroup(
        [buffers.slopeX, buffers.slopeZ],
        layerState.gradientFBO,
        layerState.N,
        pingFBO,
        pongFBO
      )
      this.computeGroup(
        [buffers.dDx_dx, buffers.dDz_dz, buffers.dDx_dz, buffers.dDz_dx],
        layerState.jacobianFBO,
        layerState.N,
        pingFBO,
        pongFBO
      )

      // 3: 每帧 IFFT 完成后刷新 mipmap 链（每次 level-0 被写新内容（每帧 IFFT），mipmap 链就过期了，需要重新调用）
      layerState.displacementFBO.regenerateMipmaps()
      layerState.gradientFBO.regenerateMipmaps()
      layerState.jacobianFBO.regenerateMipmaps()
    }
  }
  /**
   * 对一组 ComplexBuffer 执行完整的 2D IFFT：
   *   上传 → 水平 Stockham × log2(N) → 垂直 Stockham × log2(N) → 输出 FBO
   */
  private computeGroup(
    inputs: ComplexBuffer[],
    outputFBO: FBO,
    N: number,
    pingFBO: FBO,
    pongFBO: FBO
  ): void {
    const gl = this.gl
    const log2N = Math.log2(N)

    // 保存 GL 状态
    const savedFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer
    const savedViewport = gl.getParameter(gl.VIEWPORT) as Int32Array
    const vpX = savedViewport[0] ?? 0
    const vpY = savedViewport[1] ?? 0
    const vpW = savedViewport[2] ?? gl.canvas.width
    const vpH = savedViewport[3] ?? gl.canvas.height

    // 禁用深度测试（fullscreen quad 不参与深度比较）
    gl.disable(gl.DEPTH_TEST)

    // 上传 ComplexBuffer → 输入纹理
    const inputTextures = inputs.map((buf) => this.uploadComplexBuffer(buf, N))

    // Stockham IFFT: 水平 pass
    let readTextures = inputTextures
    let writeFBO = pingFBO
    let usePing = true

    for (let stage = 0; stage < log2N; stage++) {
      const subtransformSize = Math.pow(2, stage + 1)
      this.renderStockhamStage(readTextures, writeFBO, subtransformSize, N, true, 0, false)
      // Ping-pong 切换
      readTextures = this.getTexturesFromFBO(writeFBO, inputs.length)
      writeFBO = usePing ? pongFBO : pingFBO
      usePing = !usePing
    }
    // Stockham IFFT: 垂直 pass
    for (let stage = 0; stage < log2N; stage++) {
      const subtransformSize = Math.pow(2, stage + 1)
      const isLastStage = stage === log2N - 1
      const targetFBO = isLastStage ? outputFBO : writeFBO

      // 最后一个 stage 写入输出 FBO
      this.renderStockhamStage(readTextures, targetFBO, subtransformSize, N, true, 1, isLastStage)

      if (!isLastStage) {
        readTextures = this.getTexturesFromFBO(writeFBO, inputs.length)
        writeFBO = usePing ? pongFBO : pingFBO
        usePing = !usePing
      }
    }

    // 清理输入纹理
    for (const tex of inputTextures) gl.deleteTexture(tex)

    // 恢复 GL 状态
    gl.enable(gl.DEPTH_TEST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFramebuffer)
    gl.viewport(vpX, vpY, vpW, vpH)
  }

  /** 渲染单个 Stockham stage */
  private renderStockhamStage(
    inputTextures: WebGLTexture[],
    outputFBO: FBO,
    subtransformSize: number,
    transformSize: number,
    inverse: boolean,
    direction: number,
    finalStage: boolean
  ): void {
    if (!this.stockhamShader || !this.fullscreenQuad) return
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.getFrameBuffer())
    gl.viewport(0, 0, transformSize, transformSize)

    this.stockhamShader.use()

    const textureNames = ['uInputTexture0', 'uInputTexture1', 'uInputTexture2', 'uInputTexture3']
    for (let i = 0; i < inputTextures.length; i++) {
      this.stockhamShader.setTexture2D(textureNames[i]!, inputTextures[i]!, i)
    }

    this.stockhamShader.set1i('uNumChannels', inputTextures.length)
    this.stockhamShader.set1i('uSubtransformSize', subtransformSize)
    this.stockhamShader.set1i('uTransformSize', transformSize)
    this.stockhamShader.set1i('uInverse', inverse ? 1 : 0)
    this.stockhamShader.set1i('uDirection', direction)
    this.stockhamShader.set1i('uFinalStage', finalStage ? 1 : 0)

    this.fullscreenQuad.bind(gl)
    gl.drawElements(gl.TRIANGLES, this.fullscreenQuad.count, this.fullscreenQuad.indexData!.type, 0)

    for (let i = 0; i < inputTextures.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }
  }

  /** ComplexBuffer → GPU 纹理（使用 toTextureData 一步到位） */
  private uploadComplexBuffer(buf: ComplexBuffer, N: number): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    const data = buf.toTextureData()

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    return texture
  }

  private getTexturesFromFBO(fbo: FBO, count: number): WebGLTexture[] {
    const textures: WebGLTexture[] = []
    for (let i = 0; i < count; i++) textures.push(fbo.getTexture(i)!)
    return textures
  }

  // ============================================================
  //  生命周期
  // ============================================================
  dispose(): void {
    for (const pingFBO of this.pingFBOs) {
      pingFBO.dispose()
    }
    for (const pongFBO of this.pongFBOs) {
      pongFBO.dispose()
    }
    for (const layerState of this.layerStates) {
      layerState.displacementFBO.dispose()
      layerState.gradientFBO.dispose()
      layerState.jacobianFBO.dispose()
    }
  }
}
