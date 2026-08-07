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

/**
 * FFT Ocean 计算 Pass
 *
 * 实现 RenderPass 接口，在 ForwardRenderPass 之前执行。
 *
 * 职责：
 * 1. 持有 CPU 端的 InitialSpectrum + RealtimeSpectrum（ComplexBuffer）
 * 2. 每帧生成 9 个频域 ComplexBuffer → 上传为纹理
 * 3. 通过 Stockham FFT shader + ping-pong FBO 执行 GPU IFFT
 * 4. 输出 3 张空间域纹理（displacement / gradient / jacobian）
 *
 * FBO 结构：
 * - ping-pong FBO：4 个 color attachment（MRT，中间 stage 每个 attachment 存一个通道）
 * - 输出 FBO：各 1 个 color attachment（最终 stage 通过 uFinalStage 将所有通道 real 部分打包到 RGBA）
 *   - displacement：RGBA = (dispX, height, dispZ, 0)
 *   - gradient：RGBA = (slopeX, slopeZ, 0, 0)
 *   - jacobian：RGBA = (dDx_dx, dDz_dz, dDx_dz, dDz_dx)
 *
 * 使用的项目基础设施：
 * - src/framebuffers/FBO          → ping-pong FBO + 3 个输出 FBO
 * - src/objects/FullScreenQuad    → fullscreen quad（2 个三角形）
 * - src/shaders/Shader            → Stockham FFT fragment shader
 *
 * 纹理传递：
 *   addReceiver() 时一次性绑定 FBO 输出纹理到 renderer 的 material，
 *   后续 IFFT 每帧更新 FBO 内容，material 在 applyUniforms 时自动采样到最新数据。
 *
 * 注册方式（由上层场景初始化代码完成）：
 *   const computePass = new FFTOceanComputePass(gl, oceanParams)
 *   webGLRenderer.addRenderPass(computePass)   // 先于 ForwardRenderPass 注册
 *   computePass.addReceiver(oceanRenderer)      // 一次性绑定纹理
 */
export class FFTOceanComputePass implements RenderPass {
  public readonly name = 'FFTOceanComputePass'

  // ---- GPU 端：IFFT 管线 ----
  private readonly gl: WebGLRenderingContext
  private readonly N: number

  // ---- CPU 端：频谱计算 ----
  private readonly realtimeSpectrum: RealtimeSpectrum

  // Fullscreen quad（复用 Mesh 类）
  private fullscreenQuad: FullScreenQuad

  // Stockham FFT shader（水平 + 垂直 pass）
  private stockhamShader: Shader

  // ---- Receiver 管理（类似 ShadowRenderPass 的 casters/receivers）----
  private readonly receivers = new Set<BaseRenderer>()

  // Ping-pong FBO（Stockham 算法的中间 buffer）
  private pingFBO: FBO
  private pongFBO: FBO

  // 3 个输出 FBO（最终 IFFT 结果写入这里）
  private displacementFBO: FBO // [dispX, height, dispZ]     → 3 个 color attachment
  private gradientFBO: FBO // [slopeX, slopeZ]           → 2 个 color attachment
  private jacobianFBO: FBO // [dDx_dx, dDz_dz, dDx_dz, dDz_dx] → 4 个 color attachment

  static async create(gl: WebGLRenderingContext, params: OceanParams, spectrum?: Spectrum) {
    const ctx = '[FFTOceanComputePass]'

    const N = params.fftResolution

    // ---- CPU 端初始化 ----
    const spectrumModel = spectrum ?? new PhillipsSpectrum()
    const initialSpectrum = new InitialSpectrum(params, spectrumModel)
    const realtimeSpectrum = new RealtimeSpectrum(params, initialSpectrum)

    const stockhamShader = await Shader.createShader(
      gl,
      ShaderPaths.FFT_STOCKHAM_VERTEX,
      ShaderPaths.FFT_STOCKHAM_2D_FRAGMENT
    )

    const fullScreenQuad = new FullScreenQuad(gl, `FullScreenQuad<${ctx}>`)
    fullScreenQuad.createVBOs(gl)
    fullScreenQuad.cacheAttriLocations(stockhamShader)

    return new FFTOceanComputePass(gl, N, realtimeSpectrum, fullScreenQuad, stockhamShader)
  }

  constructor(
    gl: WebGLRenderingContext,
    resolution: number,
    realtimeSpectrum: RealtimeSpectrum,
    fullScreenQuad: FullScreenQuad,
    shader: Shader
  ) {
    this.gl = gl
    this.N = resolution

    this.fullscreenQuad = fullScreenQuad
    this.stockhamShader = shader

    // ---- CPU 端初始化 ----
    this.realtimeSpectrum = realtimeSpectrum

    // ---- GPU 端初始化 ----

    const pingpongTextureConfig = {
      type: gl.FLOAT, // 32 位浮点，支持负值和大范围
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE
    }
    // Ping-pong FBO：4 个 color attachment（MRT，每个 attachment 存一个通道的 complex 数据）
    this.pingFBO = new FBO(gl, {
      width: this.N,
      height: this.N,
      colorAttachmentCount: 4,
      colorTextureConfig: pingpongTextureConfig
    })
    this.pongFBO = new FBO(gl, {
      width: this.N,
      height: this.N,
      colorAttachmentCount: 4,
      colorTextureConfig: pingpongTextureConfig
    })

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
    this.displacementFBO = new FBO(gl, {
      width: this.N,
      height: this.N,
      colorAttachmentCount: 1,
      colorTextureConfig: renderOutTextureConfig
    })
    this.gradientFBO = new FBO(gl, {
      width: this.N,
      height: this.N,
      colorAttachmentCount: 1,
      colorTextureConfig: renderOutTextureConfig
    })
    this.jacobianFBO = new FBO(gl, {
      width: this.N,
      height: this.N,
      colorAttachmentCount: 1,
      colorTextureConfig: renderOutTextureConfig
    })
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
   * 将 IFFT 输出纹理推送到 renderer 的 material
   *
   * 通过 renderer.updateMaterialUniforms() 更新 JS 端数据，
   * 下次 ForwardPass 执行 renderer.draw() 时 applyUniforms 会写入 GPU。
   */
  // private applyOutputTextures(renderer: BaseRenderer): void {
  //   const uniforms: Uniforms = {
  //     uDisplacementMap: {
  //       type: UniformType.TEXTURE_2D,
  //       value: this.displacementFBO.getTexture(0)
  //     },
  //     uGradientMap: {
  //       type: UniformType.TEXTURE_2D,
  //       value: this.gradientFBO.getTexture(0)
  //     },
  //     uDispDerivativeMap: {
  //       type: UniformType.TEXTURE_2D,
  //       value: this.jacobianFBO.getTexture(0)
  //     }
  //   }

  //   renderer.updateMaterialUniforms(uniforms)
  // }

  /**
   * 一次性将输出 FBO 的纹理绑定到 renderer 的 material
   *
   * 纹理 handle 不变，内容由 IFFT 每帧更新，
   * Material.applyUniforms() 时会用 gl.bindTexture 绑定当前内容。
   */
  private bindOutputTextures(renderer: BaseRenderer): void {
    const uniforms: Uniforms = {
      uDisplacementMap: {
        type: UniformType.TEXTURE_2D,
        value: this.displacementFBO.getTexture(0)!
      },
      uGradientMap: {
        type: UniformType.TEXTURE_2D,
        value: this.gradientFBO.getTexture(0)!
      },
      uDispDerivativeMap: {
        type: UniformType.TEXTURE_2D,
        value: this.jacobianFBO.getTexture(0)!
      }
    }

    renderer.updateMaterialUniforms(uniforms)
  }

  // ============================================================
  //  RenderPass 接口
  // ============================================================

  execute(context: FrameContext, _camera: PerspectiveCamera): void {
    if (!this.stockhamShader || !this.fullscreenQuad) return

    // 1: CPU 端生成 9 个频域 ComplexBuffer（零 GC）
    const buffers = this.realtimeSpectrum.generateAtTime(context.elapsedTime)

    // console.debug(buffers)

    // 2: GPU IFFT（分 3 组，对应 3 个输出 FBO）
    this.computeGroup([buffers.height, buffers.dispX, buffers.dispZ], this.displacementFBO)
    this.computeGroup([buffers.slopeX, buffers.slopeZ], this.gradientFBO)
    this.computeGroup(
      [buffers.dDx_dx, buffers.dDz_dz, buffers.dDx_dz, buffers.dDz_dx],
      this.jacobianFBO
    )

    // 3: 每帧 IFFT 完成后刷新 mipmap 链（每次 level-0 被写新内容（每帧 IFFT），mipmap 链就过期了，需要重新调用）
    this.displacementFBO.regenerateMipmaps()
    this.gradientFBO.regenerateMipmaps()
    this.jacobianFBO.regenerateMipmaps()
  }

  /**
   * 对一组 ComplexBuffer 执行完整的 2D IFFT：
   *   上传 → 水平 Stockham × log2(N) → 垂直 Stockham × log2(N) → 输出 FBO
   */
  private computeGroup(inputs: ComplexBuffer[], outputFBO: FBO): void {
    const gl = this.gl
    const N = this.N
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
    const inputTextures = inputs.map((buf) => this.uploadComplexBuffer(buf))

    // Stockham IFFT: 水平 pass
    let readTextures = inputTextures
    let writeFBO = this.pingFBO
    let usePing = true

    for (let stage = 0; stage < log2N; stage++) {
      const subtransformSize = Math.pow(2, stage + 1)
      this.renderStockhamStage(readTextures, writeFBO, subtransformSize, N, true, 0, false)
      // Ping-pong 切换
      readTextures = this.getTexturesFromFBO(writeFBO, inputs.length)
      writeFBO = usePing ? this.pongFBO : this.pingFBO
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
        writeFBO = usePing ? this.pongFBO : this.pingFBO
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
  private uploadComplexBuffer(buf: ComplexBuffer): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    const data = buf.toTextureData()

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.N, this.N, 0, gl.RGBA, gl.FLOAT, data)
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
    this.pingFBO.dispose()
    this.pongFBO.dispose()
    this.displacementFBO.dispose()
    this.gradientFBO.dispose()
    this.jacobianFBO.dispose()
  }
}
