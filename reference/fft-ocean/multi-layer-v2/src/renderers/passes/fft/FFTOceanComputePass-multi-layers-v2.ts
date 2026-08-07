import { FBO } from '@/framebuffers/FBO'
import { RealtimeSpectrum } from '@/simulation/ocean/fft/RealtimeSpectrum-v2'
import { RenderPass } from '../types/RenderPass'
import { FullScreenQuad } from '@/objects/FullScreenQuad'
import { Shader } from '@/shaders/Shader'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'
import { Spectrum } from '@/simulation/ocean/spectrums/Spectrum'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { InitialSpectrum } from '@/simulation/ocean/fft/InitialSpectrum'
import { PhillipsSpectrum } from '@/simulation/ocean/spectrums/PhillipsSpectrum'
import { Uniforms, UniformType } from '@/materials/types/Material'
import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { ComplexBuffer } from '@/simulation/ocean/fft/ComplexBuffer'
import { Vec2 } from '@/math/types/math'

interface LayerState {
  N: number
  size: number
  realtimeSpectrum: RealtimeSpectrum
  /** x/y 轴的波浪尖锐度（choppy waves 系数 λ） */
  choppiness: Vec2
  /** 4 个 packed IFFT 输出 FBO（每个 1 color attachment, RG=Re/Im） */
  packedFBOs: FBO[]
  /** 最终 3 张图（displacement, gradient, jacobian, derivative， foam）—— 由 assembly pass MRT 写入 */
  finalFBOs: [FBO, FBO] // 0/1 双缓冲
  currentFinalIdx: 0 | 1 // 当前帧写入到哪个；0/1 交替
  // foam 参数
  foamDecayRate: number
  foamAdd: number
  foamBias: number
  foamPower: number
}

export class FFTOceanComputePass implements RenderPass {
  public readonly name = 'FFTOceanComputePass'

  private readonly gl: WebGLRenderingContext

  private pingFBOs: FBO[] = []
  private pongFBOs: FBO[] = []

  private layerStates: LayerState[] = []

  private fullscreenQuad: FullScreenQuad
  private stockhamShader: Shader
  private assemblyShader: Shader

  /** 全局 choppiness，默认 (0.4, 0.4) */
  // private choppiness: [number, number] = [0.4, 0.4]

  private readonly receivers = new Set<BaseRenderer>()

  static async create(
    gl: WebGLRenderingContext,
    paramsCascade: OceanParams[],
    spectrum?: Spectrum
    // choppiness: [number, number] = [0.4, 0.4]
  ): Promise<FFTOceanComputePass> {
    const ctx = '[FFTOceanComputePass]'

    const stockhamShader = await Shader.createShader(
      gl,
      ShaderPaths.FFT_STOCKHAM_VERTEX,
      ShaderPaths.FFT_STOCKHAM_2D_FRAGMENT
    )
    const assemblyShader = await Shader.createShader(
      gl,
      ShaderPaths.FFT_PACKED_ASSEMBLY_VERTEX,
      ShaderPaths.FFT_PACKED_ASSEMBLY_FRAGMENT
    )

    const fullScreenQuad = new FullScreenQuad(gl, `FullScreenQuad<${ctx}>`)
    fullScreenQuad.createVBOs(gl)
    fullScreenQuad.cacheAttriLocations(stockhamShader)
    fullScreenQuad.cacheAttriLocations(assemblyShader)

    const pass = new FFTOceanComputePass(gl, fullScreenQuad, stockhamShader, assemblyShader)
    // pass.choppiness = choppiness

    for (const params of paramsCascade) {
      pass.addLayer(params, spectrum)
    }

    return pass
  }

  constructor(
    gl: WebGLRenderingContext,
    fullScreenQuad: FullScreenQuad,
    stockham: Shader,
    assembly: Shader
  ) {
    this.gl = gl
    this.fullscreenQuad = fullScreenQuad
    this.stockhamShader = stockham
    this.assemblyShader = assembly
  }

  private addLayer(params: OceanParams, spectrum?: Spectrum) {
    const gl = this.gl
    const N = params.fftResolution
    const choppiness = params.choppiness

    const initialSpectrum = new InitialSpectrum(params, spectrum ?? new PhillipsSpectrum())
    const realtimeSpectrum = new RealtimeSpectrum(params, initialSpectrum)

    // Ping-pong：只需要 1 channel（RG 存一个复数）
    const ppConfig = {
      type: gl.FLOAT,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE
    }
    const pingFBO = new FBO(gl, {
      width: N,
      height: N,
      colorAttachmentCount: 1,
      colorTextureConfig: ppConfig
    })
    const pongFBO = new FBO(gl, {
      width: N,
      height: N,
      colorAttachmentCount: 1,
      colorTextureConfig: ppConfig
    })
    this.pingFBOs.push(pingFBO)
    this.pongFBOs.push(pongFBO)

    // 4 个 packed IFFT 结果 FBO
    const packedConfig = {
      internalFormat: gl.RGBA,
      format: gl.RGBA,
      type: gl.FLOAT,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE
    }
    const packedFBOs: FBO[] = []
    for (let i = 0; i < 4; i++) {
      packedFBOs.push(
        new FBO(gl, {
          width: N,
          height: N,
          colorAttachmentCount: 1,
          colorTextureConfig: packedConfig
        })
      )
    }

    // 最终输出 FBO：3 个 color attachments（displacement / gradient / jacobian）
    const finalConfig = {
      internalFormat: gl.RGBA,
      format: gl.RGBA,
      type: gl.FLOAT,
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.REPEAT,
      wrapT: gl.REPEAT,
      generateMipmap: true
    }
    // const finalConfig = {
    //   internalFormat: gl.RGBA,
    //   format: gl.RGBA,
    //   type: gl.FLOAT,
    //   minFilter: gl.NEAREST,
    //   magFilter: gl.NEAREST,
    //   wrapS: gl.REPEAT,
    //   wrapT: gl.REPEAT,
    //   generateMipmap: false
    // }
    // const finalFBO = new FBO(gl, {
    //   width: N,
    //   height: N,
    //   colorAttachmentCount: 3,
    //   colorTextureConfig: finalConfig
    // })

    // this.layerStates.push({
    //   N,
    //   size: params.size,
    //   realtimeSpectrum,
    //   choppiness,
    //   packedFBOs,
    //   finalFBO
    // })
    const finalFBOs: [FBO, FBO] = [
      new FBO(gl, {
        width: N,
        height: N,
        colorAttachmentCount: 3,
        colorTextureConfig: finalConfig
      }),
      new FBO(gl, {
        width: N,
        height: N,
        colorAttachmentCount: 3,
        colorTextureConfig: finalConfig
      })
    ]

    // 第一帧 prevFoam 不存在 —— 把两份都清成 0
    for (const fbo of finalFBOs) {
      fbo.bind()
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }

    this.layerStates.push({
      N,
      size: params.size,
      realtimeSpectrum,
      choppiness,
      packedFBOs,
      finalFBOs,
      currentFinalIdx: 0,
      foamDecayRate: params.foamDecayRate ?? 0.05,
      foamAdd: params.foamAdd ?? 0.1,
      foamBias: params.foamBias ?? 0.2,
      foamPower: params.foamPower ?? 1.5
    })
  }

  // ---- Receiver 管理 ----
  addReceiver(renderer: BaseRenderer): void {
    this.receivers.add(renderer)
    this.bindOutputTextures(renderer)
  }
  removeReceiver(renderer: BaseRenderer): void {
    this.receivers.delete(renderer)
  }
  private bindOutputTextures(renderer: BaseRenderer): void {
    const uniforms: Uniforms = {}
    for (let i = 0; i < this.layerStates.length; i++) {
      const st = this.layerStates[i]!
      // 注意：currentFinalIdx 已经在 runAssemblyPass 末尾翻到下一帧了
      // 所以"当前应该读的"= 1 - currentFinalIdx
      const latestIdx = (1 - st.currentFinalIdx) as 0 | 1
      const finalFBO = st.finalFBOs[latestIdx]
      uniforms[`uDisplacementMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: finalFBO.getTexture(0)!
      }
      uniforms[`uGradientMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: finalFBO.getTexture(1)!
      }
      uniforms[`uDispDerivativeMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: finalFBO.getTexture(2)!
      }
      uniforms[`uLayerSize${i}`] = {
        type: UniformType.ONE_F,
        value: st.size
      }
    }
    renderer.updateMaterialUniforms(uniforms)
  }

  // ============================================================
  //  RenderPass 主循环
  // ============================================================
  execute(context: FrameContext, _camera: PerspectiveCamera): void {
    const gl = this.gl
    // 保存 GL 状态
    const savedFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer
    const savedViewport = gl.getParameter(gl.VIEWPORT) as Int32Array
    const vpX = savedViewport[0] ?? 0
    const vpY = savedViewport[1] ?? 0
    const vpW = savedViewport[2] ?? gl.canvas.width
    const vpH = savedViewport[3] ?? gl.canvas.height

    gl.disable(gl.DEPTH_TEST)

    for (let i = 0; i < this.layerStates.length; i++) {
      const layerState = this.layerStates[i]!
      const pingFBO = this.pingFBOs[i]!
      const pongFBO = this.pongFBOs[i]!

      // 1 CPU：生成 4 packed ComplexBuffer
      const buffers = layerState.realtimeSpectrum.generateAtTime(context.elapsedTime)
      const packedInputs = [buffers.pack0, buffers.pack1, buffers.pack2, buffers.pack3]

      // 2 GPU：4 次单信号 2D IFFT，各自写入 packedFBOs[i]
      for (let p = 0; p < 4; p++) {
        this.computeSingleIFFT(
          packedInputs[p]!,
          layerState.packedFBOs[p]!,
          layerState.N,
          pingFBO,
          pongFBO
        )
      }

      // 3) Assembly pass：把 4 个 packed 解包成 displacement/gradient/jacobian
      this.runAssemblyPass(layerState)

      // 4) 刷新 mipmap（只对"当前写"的 FBO 做 mipmap）
      // layerState.finalFBO.regenerateMipmaps()
      layerState.finalFBOs[layerState.currentFinalIdx].regenerateMipmaps()
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFramebuffer)
    gl.viewport(vpX, vpY, vpW, vpH)
    gl.enable(gl.DEPTH_TEST)

    // 把最新输出贴图绑给所有 receiver
    for (const recv of this.receivers) {
      this.bindOutputTextures(recv)
    }
  }

  /**
   * 单信号 2D IFFT（水平 log2N 次 + 垂直 log2N 次，最后一次写到 outputFBO）
   * —— 不做 "pack 4 reals" 的 final stage，纯保留 RG
   */
  private computeSingleIFFT(
    input: ComplexBuffer,
    outputFBO: FBO,
    N: number,
    pingFBO: FBO,
    pongFBO: FBO
  ): void {
    const gl = this.gl
    const log2N = Math.log2(N)

    const inputTex = this.uploadComplexBuffer(input, N)

    let readTex = inputTex
    let writeFBO = pingFBO
    let usePing = true

    // 水平 pass
    for (let stage = 0; stage < log2N; stage++) {
      const sub = Math.pow(2, stage + 1)
      this.renderStockhamStage([readTex], writeFBO, sub, N, true, 0)
      readTex = writeFBO.getTexture(0)!
      writeFBO = usePing ? pongFBO : pingFBO
      usePing = !usePing
    }
    // 垂直 pass
    for (let stage = 0; stage < log2N; stage++) {
      const sub = Math.pow(2, stage + 1)
      const isLast = stage === log2N - 1
      const target = isLast ? outputFBO : writeFBO
      this.renderStockhamStage([readTex], target, sub, N, true, 1)
      if (!isLast) {
        readTex = writeFBO.getTexture(0)!
        writeFBO = usePing ? pongFBO : pingFBO
        usePing = !usePing
      }
    }

    gl.deleteTexture(inputTex)
  }

  private renderStockhamStage(
    inputTextures: WebGLTexture[],
    outputFBO: FBO,
    subtransformSize: number,
    transformSize: number,
    inverse: boolean,
    direction: number
  ): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.getFrameBuffer())
    gl.viewport(0, 0, transformSize, transformSize)

    this.stockhamShader.use()
    const names = ['uInputTexture0', 'uInputTexture1', 'uInputTexture2', 'uInputTexture3']
    for (let i = 0; i < inputTextures.length; i++) {
      this.stockhamShader.setTexture2D(names[i]!, inputTextures[i]!, i)
    }
    this.stockhamShader.set1i('uNumChannels', inputTextures.length)
    this.stockhamShader.set1i('uSubtransformSize', subtransformSize)
    this.stockhamShader.set1i('uTransformSize', transformSize)
    this.stockhamShader.set1i('uInverse', inverse ? 1 : 0)
    this.stockhamShader.set1i('uDirection', direction)
    this.stockhamShader.set1i('uFinalStage', 0) // 永远不做 final real-pack

    this.fullscreenQuad.bind(gl)
    gl.drawElements(gl.TRIANGLES, this.fullscreenQuad.count, this.fullscreenQuad.indexData!.type, 0)
  }

  /** 把 4 个 packed IFFT 输出解包成 displacement/gradient/jacobian */
  private runAssemblyPass(layerState: LayerState): void {
    const gl = this.gl

    const writeIdx = layerState.currentFinalIdx
    const readIdx = (1 - writeIdx) as 0 | 1

    const writeFBO = layerState.finalFBOs[writeIdx]
    const readFBO = layerState.finalFBOs[readIdx]

    // // 保存 GL 状态
    // const savedFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer
    // const savedViewport = gl.getParameter(gl.VIEWPORT) as Int32Array
    // const vpX = savedViewport[0] ?? 0
    // const vpY = savedViewport[1] ?? 0
    // const vpW = savedViewport[2] ?? gl.canvas.width
    // const vpH = savedViewport[3] ?? gl.canvas.height

    writeFBO.bind()
    gl.viewport(0, 0, layerState.N, layerState.N)
    gl.disable(gl.DEPTH_TEST)

    this.assemblyShader.use()
    this.assemblyShader.setTexture2D('uPacked0', layerState.packedFBOs[0]!.getTexture(0)!, 0)
    this.assemblyShader.setTexture2D('uPacked1', layerState.packedFBOs[1]!.getTexture(0)!, 1)
    this.assemblyShader.setTexture2D('uPacked2', layerState.packedFBOs[2]!.getTexture(0)!, 2)
    this.assemblyShader.setTexture2D('uPacked3', layerState.packedFBOs[3]!.getTexture(0)!, 3)

    // 关键：上一帧的 displacement（含 foam.a）
    this.assemblyShader.setTexture2D('uPrevDisplacement', readFBO.getTexture(0)!, 4)

    this.assemblyShader.setVec2('uChoppiness', layerState.choppiness)
    this.assemblyShader.set1f('uFoamDecayRate', layerState.foamDecayRate)
    this.assemblyShader.set1f('uFoamAdd', layerState.foamAdd)
    this.assemblyShader.set1f('uFoamBias', layerState.foamBias)
    this.assemblyShader.set1f('uFoamPower', layerState.foamPower)

    this.fullscreenQuad.bind(gl)
    gl.drawElements(gl.TRIANGLES, this.fullscreenQuad.count, this.fullscreenQuad.indexData!.type, 0)

    // gl.enable(gl.DEPTH_TEST)
    // gl.bindFramebuffer(gl.FRAMEBUFFER, savedFramebuffer)
    // gl.viewport(vpX, vpY, vpW, vpH)

    // 切换 ping-pong
    layerState.currentFinalIdx = readIdx
  }

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

  // ============================================================
  //  GUI 用：运行时参数更新
  // ============================================================

  /** 热更新：每层的 choppiness（仅改 assembly shader 用的值） */
  setLayerChoppiness(layerIndex: number, choppiness: Vec2): void {
    const layer = this.layerStates[layerIndex]
    if (!layer) return
    layer.choppiness = choppiness
  }

  /**
   * 冷更新：用新参数重建该层的 InitialSpectrum 和 RealtimeSpectrum
   * 不重建 FBO（N 不变），只重新生成 h0 + 时域演化器
   */
  rebuildLayerSpectrum(layerIndex: number, newParams: OceanParams, spectrum: Spectrum): void {
    const layer = this.layerStates[layerIndex]
    if (!layer) return
    if (newParams.fftResolution !== layer.N) {
      console.warn(
        `[FFTOceanComputePass] N 不一致，无法热重建（旧=${layer.N}, 新=${newParams.fftResolution}），需要重建整个 pass`
      )
      return
    }
    const initialSpectrum = new InitialSpectrum(newParams, spectrum)
    layer.realtimeSpectrum = new RealtimeSpectrum(newParams, initialSpectrum)
    layer.size = newParams.size
    layer.choppiness = newParams.choppiness
  }

  // ============================================================
  //  dispose
  // ============================================================
  dispose(): void {
    for (const f of this.pingFBOs) f.dispose()
    for (const f of this.pongFBOs) f.dispose()
    for (const st of this.layerStates) {
      for (const f of st.packedFBOs) f.dispose()
      // st.finalFBO.dispose()
      for (const f of st.finalFBOs) f.dispose()
    }
  }
}
