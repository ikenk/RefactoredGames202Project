import { BaseRenderer } from '@/renderers/BaseRenderer'
import { PerspectiveCamera } from 'three'
import { RenderPass } from '../types/RenderPass'
import { FrameContext } from '@/renderers/types/FrameContext'
import { GBufferFBO } from '@/framebuffers/GBufferFBO'
import { RenderTargetScope } from '@/renderers/types/RenderTargetScope'

// /**
//  * GBuffer 渲染 Pass
//  *
//  * 将场景几何信息渲染到 5-attachment G-Buffer：
//  * Diffuse, Depth, Normal, Shadow, WorldPosition
//  *
//  * 目标 renderer 必须使用 GBufferMaterial
//  */
// export class GBufferRenderPass implements RenderPass {
//   public readonly name: string = 'GBufferRenderPass'

//   private gl: WebGLRenderingContext

//   private gBufferFBO: GBufferFBO
//   private targetRenderers: BaseRenderer[] = []

//   constructor(gl: WebGLRenderingContext, width: number, height: number) {
//     this.gl = gl

//     this.gBufferFBO = new GBufferFBO(gl, width, height)
//   }

//   execute(context: FrameContext, camera: PerspectiveCamera): void {
//     const gl = this.gl

//     this.gBufferFBO.bind()
//     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

//     // shader 只 use 一次，不是每个 renderer 内部各 use 一次
//     // const shader = this.targetRenderers[0]?.shader
//     // shader?.use()

//     const fbo = this.gBufferFBO.getFBO()
//     for (const targetRenderer of this.targetRenderers) {
//       // draw() 内部又会 shader.use()，但因为 program 没变，是幂等操作
//       // 真正的开销在 mesh.bind()（切换 VBO）和 material.applyUniforms()（切换纹理）
//       targetRenderer.draw(context, fbo, camera)
//     }

//     this.gBufferFBO.unbind(gl.canvas.width, gl.canvas.height)
//   }

//   addTarget(renderer: BaseRenderer): void {
//     this.targetRenderers.push(renderer)
//   }

//   /** 获取 GBufferFBO（供后续 pass 读取纹理） */
//   getGBufferFBO(): GBufferFBO {
//     return this.gBufferFBO
//   }

//   resize(width: number, height: number): void {
//     this.gBufferFBO.resize(width, height)
//   }

//   /**
//    * 释放本 pass 持有的 GPU 资源
//    *
//    * 所有权约定：
//    * - GBufferRenderPass 是 deferred 管线的「主 pass」，地位对标 forward 管线的 ForwardRenderPass，
//    *   因此由它负责释放 targetRenderers（HW3 的场景没有 ForwardRenderPass，没人接手就会泄漏）
//    * - ShadowRenderPass 只是持有同一批 renderer 的引用，不负责释放（见该类的 dispose 注释），
//    *   所以这里不会造成重复 dispose
//    *
//    * 历史问题：
//    * - 本方法原先只做 targetRenderers.length = 0，renderer 里的 VBO / VAO / Shader 全部泄漏
//    * - 该泄漏曾意外「掩盖」了顶点属性槽位残留的 bug：HW3 的 VBO 没被删除，
//    *   槽位 3 才一直指着一块活 buffer，让 HW3 → HW4 看上去正常。
//    *   VAO 改造完成后这层依赖已经消失，可以安全释放
//    */
//   // dispose(): void {
//   //   this.gBufferFBO.dispose()
//   //   this.targetRenderers.length = 0
//   // }
//   dispose(): void {
//     this.gBufferFBO.dispose()

//     for (const targetRenderer of this.targetRenderers) {
//       targetRenderer.dispose()
//     }
//     this.targetRenderers.length = 0
//   }
// }

/**
 * GBuffer 渲染 Pass。
 *
 * 将场景几何信息渲染到 5-attachment G-Buffer：
 * Diffuse、Depth、Normal、Shadow、WorldPosition。
 *
 * 资源所有权：
 * - 本 pass 创建、持有、resize、dispose GBufferFBO；
 * - SSR 等后续 pass 只能借用其 attachments；
 * - RenderTargetScope 只在 execute 期间借用内部 FBO 进行绑定，不取得所有权。
 *
 * 和 three.js 的联系：
 * 一个 pass 决定一段绘制写向哪个 RenderTarget，单个 Mesh 不决定输出目标。
 *
 * 和当前实现的区别：
 * 当前代码由 pass.bind、每个 BaseRenderer.draw 再 bind、每个 draw 再 unbind。
 * 候选代码只进入一次 GBuffer 作用域，连续绘制所有 targetRenderers，
 * 最后由作用域统一恢复进入前的真实目标。
 */
export class GBufferRenderPass implements RenderPass {
  public readonly name: string = 'GBufferRenderPass'

  private gl: WebGLRenderingContext

  private gBufferFBO: GBufferFBO
  private targetRenderers: BaseRenderer[] = []

  constructor(gl: WebGLRenderingContext, width: number, height: number) {
    this.gl = gl
    this.gBufferFBO = new GBufferFBO(gl, width, height)
  }

  execute(
    context: FrameContext,
    camera: PerspectiveCamera,
    renderTargets: RenderTargetScope
  ): void {
    const gl = this.gl

    /**
     * GBufferFBO 是拥有资源和 attachment 语义的包装器；
     * getFBO() 返回的 FBO 满足 RenderTarget 的结构：
     * getFrameBuffer/getWidth/getHeight。
     */
    const target = this.gBufferFBO.getFBO()

    renderTargets.withRenderTarget(target, () => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      /**
       * 目标作用域包住整组 draw。
       *
       * 两个 Mesh 的字面时间线：
       * 绑定 G → draw mesh 1 → 仍是 G → draw mesh 2 → 仍是 G → 恢复外层。
       * BaseRenderer.draw 不再知道 G，也不再在每次 draw 后绑定 null。
       */
      for (const targetRenderer of this.targetRenderers) {
        targetRenderer.draw(context, camera)
      }
    })
  }

  addTarget(renderer: BaseRenderer): void {
    this.targetRenderers.push(renderer)
  }

  /** 获取 GBufferFBO，供后续 pass 只读借用纹理 attachments。 */
  getGBufferFBO(): GBufferFBO {
    return this.gBufferFBO
  }

  /**
   * 只有资源所有者负责 resize。
   * RenderTargetScope 不提供 resize，因此 renderer 无法越权改变目标尺寸。
   */
  resize(width: number, height: number): void {
    this.gBufferFBO.resize(width, height)
  }

  /**
   * 释放本 pass 持有的 GPU 资源。
   *
   * GBufferRenderPass 拥有 GBuffer，所以在这里 dispose。
   * RenderTargetScope 只借用过它，不参与释放。
   *
   * 当前项目还约定本 pass 拥有 targetRenderers；该规则保持不变，
   * 不在 RenderTarget 小责任中顺便重构 renderer 共享所有权。
   */
  dispose(): void {
    this.gBufferFBO.dispose()

    for (const targetRenderer of this.targetRenderers) {
      targetRenderer.dispose()
    }
    this.targetRenderers.length = 0
  }
}
