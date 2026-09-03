import { FramebufferError } from './BaseError'

/**
 * 尝试绑定已经被销毁的 RenderTarget。
 *
 * target === null 表示合法的默认 framebuffer；
 * 本错误只用于“传入了非 null target，但其 framebuffer 已经不存在”。
 */
export class RenderTargetDisposedError extends FramebufferError {
  constructor(width: number, height: number) {
    super(`Cannot bind disposed RenderTarget (${width}x${height})`, 'RENDER_TARGET_DISPOSED', {
      width,
      height,
      recoverable: false,
      context: {
        operation: 'bindRenderTarget'
      }
    })
  }

  override toUserMessage(): string {
    return `无法绑定已经释放的渲染目标（${this.width}x${this.height}）。`
  }
}
