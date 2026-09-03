import { PerspectiveCamera } from 'three'
import { BaseRenderer } from './BaseRenderer'
import { FrameContext } from './types/FrameContext'
import { RenderPass } from './passes/types/RenderPass'
import { OverlayRenderPass } from './passes/overlay/OverlayRenderPass'
import { RenderTargetScope, SynchronousRenderTargetCallback } from './types/RenderTargetScope'
import { RenderTarget } from './types/RenderTarget'
import { RenderTargetDisposedError } from '@/errors/EngineError/FramebufferError/RenderTargetDisposedError'

/**
 * withRenderTarget 进入前的真实 WebGL 状态快照。
 *
 * framebuffer 只是对象引用，不复制附件或像素。
 * viewport 则复制四个整数，避免依赖 getParameter 返回数组的后续变化。
 */
interface RenderTargetStateSnapshot {
  framebuffer: WebGLFramebuffer | null
  viewport: readonly [x: number, y: number, width: number, height: number]
}

export class WebGLRenderer implements RenderTargetScope {
  public gl: WebGLRenderingContext
  public camera: PerspectiveCamera

  /**
   * WebGLRenderer 长期拥有 pass 列表和调度关系。
   *
   * pass 不反向保存完整 WebGLRenderer；execute 时只临时收到
   * RenderTargetScope，避免 renderer → pass → renderer 的双向能力依赖。
   */
  private renderPasses: RenderPass[] = []

  private overlayRenderPass: OverlayRenderPass

  constructor(gl: WebGLRenderingContext, camera: PerspectiveCamera) {
    this.gl = gl
    this.camera = camera

    this.overlayRenderPass = new OverlayRenderPass()
  }

  // ============================================================
  //  Pass 管理
  // ============================================================
  addRenderPass(pass: RenderPass): void {
    this.renderPasses.push(pass)
  }

  removeRenderPass(name: string): void {
    const index = this.renderPasses.findIndex((pass) => pass.name === name)
    if (index > -1) {
      /**
       * 这里 dispose pass 的理由是 renderer 正在移除自己拥有的 pass。
       * 这和“renderer 曾经绑定过 pass 的 RenderTarget”没有关系。
       */
      this.renderPasses[index]?.dispose()
      this.renderPasses.splice(index, 1)
    }
  }

  getRenderPass<T extends RenderPass>(name: string): T | null {
    return (this.renderPasses.find((pass) => pass.name === name) as T) ?? null
  }

  getOverlayRenderPass(): OverlayRenderPass {
    return this.overlayRenderPass
  }

  // ============================================================
  //  RenderTarget 作用域
  // ============================================================
  /**
   * 公开给 RenderPass 的方案 C：作用域式 API。
   *
   * 正常返回和异常抛出都经过 finally，因此恢复规则只实现一次。
   * callback 的类型限制为同步函数，避免 await 跨越 WebGL 可变状态边界。
   */
  withRenderTarget(target: RenderTarget | null, callback: SynchronousRenderTargetCallback): void {
    /**
     * 必须先拍真实状态快照，再切换目标。
     *
     * 当前工程仍有大量代码绕过 WebGLRenderer 直接调用 bindFramebuffer/viewport，
     * 因此不能只相信 renderer 自己未来可能维护的 currentRenderTarget 字段。
     */
    const previous = this.captureRenderTargetState()

    try {
      /**
       * applyRenderTarget 是方案 B 缩小后的内部原语：
       * 它能执行一次目标切换，但不公开给 pass 任意调用。
       */
      this.applyRenderTarget(target)
      callback()
    } finally {
      /**
       * applyRenderTarget 或 callback 中途抛错时也会执行。
       * 恢复的是进入作用域前的真实 framebuffer 和真实 viewport，
       * 不是固定恢复 null/canvas，也不是恢复一个可能过期的逻辑缓存。
       */
      this.restoreRenderTargetState(previous)
    }
  }

  /**
   * 内部原语 1：读取真实 WebGL 状态。
   */
  private captureRenderTargetState(): RenderTargetStateSnapshot {
    const gl = this.gl
    const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array

    return {
      framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
      viewport: [
        viewport[0] ?? 0,
        viewport[1] ?? 0,
        viewport[2] ?? gl.drawingBufferWidth,
        viewport[3] ?? gl.drawingBufferHeight
      ]
    }
  }

  /**
   * 内部原语 2：绑定目标并设置匹配目标尺寸的 viewport。
   *
   * target === null 明确表示默认 framebuffer。
   * 非 null target 只提供句柄和尺寸；这里绝不调用 resize/dispose。
   *
   * 和 three.js 的联系：
   * three.js setRenderTarget 同样会同时处理 framebuffer 和 viewport。
   *
   * 和当前 FBO.bind() 的区别：
   * 这里没有每次重复 drawBuffersWEBGL。EXT_draw_buffers 规定 draw-buffer
   * 选择属于 framebuffer object 状态，重新绑定同一个 FBO 会带回其选择。
   * 若未来支持动态 attachment 布局，再由 backend 根据目标描述显式配置。
   */
  private applyRenderTarget(target: RenderTarget | null): void {
    const gl = this.gl

    if (target === null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      return
    }

    const framebuffer = target.getFrameBuffer()
    if (framebuffer === null) {
      /**
       * disposed target 不能静默退化成默认 framebuffer，否则本应写入纹理的像素
       * 会错误写到 canvas。正式实现时应为这条失败模式补独立测试。
       */
      throw new RenderTargetDisposedError(target.getWidth(), target.getHeight())
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.viewport(0, 0, target.getWidth(), target.getHeight())
  }

  /**
   * 内部原语 3：精确恢复进入作用域前的真实状态。
   */
  private restoreRenderTargetState(snapshot: RenderTargetStateSnapshot): void {
    const gl = this.gl
    const [x, y, width, height] = snapshot.viewport

    gl.bindFramebuffer(gl.FRAMEBUFFER, snapshot.framebuffer)
    gl.viewport(x, y, width, height)
  }

  // ============================================================
  //  HUD 管理
  // ============================================================
  /**
   * 注册一个 HUD 渲染器。
   *
   * HUD 渲染器不参与场景的 draw() 流程，
   * 而是在每帧最后调用 renderAsHUD()。
   *
   * @param renderer 渲染器实例，通常是 createAxisRenderer() 的返回值。
   * @param position 屏幕位置，归一化坐标，左下角为原点。
   * @param size HUD 视口大小，单位为像素。
   */
  addHUDRenderer(
    renderer: BaseRenderer,
    position: { x: number; y: number } = { x: 0.05, y: 0.05 },
    size: number = 120
  ): void {
    this.overlayRenderPass.addHUDEntry({ renderer, position, size })
  }

  /**
   * 渲染一帧。
   *
   * 最外层先建立默认 framebuffer 作用域，因此：
   * - 正常 Engine 帧明确从 canvas 开始；
   * - GBuffer/LowRes 等 pass 可以嵌套进入离屏目标；
   * - 如果外部调用者原本绑定了 A，整帧结束后仍恢复 A。
   */
  render(context: FrameContext): void {
    this.withRenderTarget(null, () => {
      const gl = this.gl
      gl.clearColor(0.0, 0.0, 0.0, 1.0)
      gl.clearDepth(1.0)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      for (const pass of this.renderPasses) {
        /**
         * 传 this 时，静态类型只暴露 RenderTargetScope 形状。
         * pass 不需要也不应该把它保存到字段；它只在本次 execute 中借用。
         */
        pass.execute(context, this.camera, this)
      }

      this.overlayRenderPass.execute(context, this.camera, this)
    })
  }

  clearRenderPasses(): void {
    console.warn('clear', this.renderPasses)

    for (const pass of this.renderPasses) {
      pass.dispose()
    }
    this.renderPasses = []
  }
}
