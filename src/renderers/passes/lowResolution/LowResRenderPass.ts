import { PerspectiveCamera } from 'three'
import { BaseRenderer } from '../../BaseRenderer'
import { FrameContext } from '../../types/FrameContext'
import { RenderPass } from '../types/RenderPass'
import { DownscaleFBO } from '@/framebuffers/DownscaleFBO'
import { Shader } from '@/shaders/Shader'
import { FullScreenQuad } from '@/objects/FullScreenQuad'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import type { RenderTargetScope } from '@/renderers/types/RenderTargetScope'

export class LowResRenderPass implements RenderPass {
  public readonly name = 'LowResRenderPass'

  private gl: WebGLRenderingContext

  private downscaleFBO: DownscaleFBO
  private targetRenderers: BaseRenderer[] = []
  private fullScreenQuad: FullScreenQuad
  private blitShader: Shader
  private scale: number

  // 由于 shader 编译是异步的，所以用 async create 代替 constructor
  static async create(gl: WebGLRenderingContext, scale: number = 0.25) {
    const downscaleFBO = new DownscaleFBO(
      gl,
      Math.floor(gl.canvas.width * scale),
      Math.floor(gl.canvas.height * scale)
    )

    const shader = await Shader.createShader(gl, ShaderPaths.BLIT_VERTEX, ShaderPaths.BLIT_FRAGMENT)

    const fullScreenQuad = new FullScreenQuad(gl, 'FullScreenQuad<LowResRenderPass>')
    fullScreenQuad.createVBOs(gl)
    fullScreenQuad.cacheAttriLocations(shader)

    return new LowResRenderPass(gl, downscaleFBO, shader, fullScreenQuad, scale)
  }

  private constructor(
    gl: WebGLRenderingContext,
    downscaleFBO: DownscaleFBO,
    blitShader: Shader,
    fullScreenQuad: FullScreenQuad,
    scale: number = 0.25
  ) {
    this.gl = gl
    this.downscaleFBO = downscaleFBO
    this.fullScreenQuad = fullScreenQuad
    this.blitShader = blitShader
    this.scale = scale
  }

  // execute(context: FrameContext, camera: PerspectiveCamera): void {
  //   const gl = this.gl
  //   const fbo = this.downscaleFBO.getFBO()

  //   // 1. 渲染到低分辨率 FBO
  //   // fbo.bind()
  //   // gl.viewport(0, 0, this.downscaleFBO.width, this.downscaleFBO.height)
  //   this.downscaleFBO.bind() // bind + viewport(上面两步) 一步到位
  //   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  //   for (const targetRenderer of this.targetRenderers) {
  //     // TODO: draw() 内部的 fbo.bind() 是幂等的重复绑定，无害。draw() 内部的 step ⑧ unbind 后，下一次循环 draw() 的 step ② 会重新 bind
  //     targetRenderer.draw(context, fbo, camera)
  //   }

  //   // unbind 虽然和 draw() step ⑧ 的解绑重复了，但代码对称工整
  //   this.downscaleFBO.unbind(gl.canvas.width, gl.canvas.height)

  //   // 2. 全屏 blit 到默认 framebuffer
  //   const texture = this.downscaleFBO.getColorTexture()
  //   if (!texture) return

  //   this.blitShader.use()
  //   this.blitShader.setTexture2D('uTexture', texture, 0)

  //   gl.disable(gl.DEPTH_TEST) // 关闭深度测试，让 fullScreenQuad 画在最顶层
  //   // this.fullScreenQuad.bind(gl)
  //   this.fullScreenQuad.bind(this.blitShader)
  //   gl.drawElements(gl.TRIANGLES, this.fullScreenQuad.count, this.fullScreenQuad.indexData!.type, 0)
  //   gl.enable(gl.DEPTH_TEST) // 恢复深度测试，恢复最初始的开启深度测试的状态
  // }

  execute(
    context: FrameContext,
    camera: PerspectiveCamera,
    renderTargets: RenderTargetScope
  ): void {
    const gl = this.gl
    const target = this.downscaleFBO.getFBO()

    renderTargets.withRenderTarget(target, () => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      for (const targetRenderer of this.targetRenderers) {
        targetRenderer.draw(context, camera)
      }
    })

    /**
     * 离开上面的作用域后，自动回到 WebGLRenderer.render 建立的默认目标，
     * 因此这里的 full-screen blit 会写向 canvas。
     */
    const texture = this.downscaleFBO.getColorTexture()
    if (!texture) return

    this.blitShader.use()
    this.blitShader.setTexture2D('uTexture', texture, 0)

    gl.disable(gl.DEPTH_TEST)
    this.fullScreenQuad.bind(this.blitShader)
    gl.drawElements(gl.TRIANGLES, this.fullScreenQuad.count, this.fullScreenQuad.indexData!.type, 0)
    gl.enable(gl.DEPTH_TEST)
  }

  resize(width: number, height: number): void {
    this.downscaleFBO.resize(width, height, this.scale)
  }

  addTarget(renderer: BaseRenderer): void {
    this.targetRenderers.push(renderer)
  }

  removeTarget(renderer: BaseRenderer): void {
    const index = this.targetRenderers.indexOf(renderer)
    if (index > -1) this.targetRenderers.splice(index, 1)
  }

  dispose(): void {
    // 1. 清理 downscaleFBO — pass 自己创建的 GPU 资源
    // 内部: FBO.dispose() → deleteFramebuffer + deleteTexture + deleteRenderbuffer
    this.downscaleFBO.dispose()

    // 2. 清理 blitShader — pass 自己创建的 GPU 资源
    // 内部: gl.deleteProgram
    this.blitShader.dispose()

    // 3. 清理 fullScreenQuad — pass 自己创建的 GPU 资源
    // 内部: Mesh.dispose() → deleteBuffer(VBO) + deleteBuffer(IBO)
    this.fullScreenQuad.dispose()

    // 4. 清理 targetRenderers 数组本身 - 断开引用，不清理其中的元素，因为其中的元素不是 pass 创建的
    this.targetRenderers.length = 0
  }
}
