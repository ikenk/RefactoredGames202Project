import { FramebufferError } from './BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * FBO releaseTexture / releaseAllTextures 阶段的错误。
 *
 * 常见原因：
 *   - MRT FBO 上调用单个 releaseTexture（不允许部分释放）
 *   - index 越界
 *   - 该 attachment 的 texture 已经被释放
 *
 * recoverable = true：调用方修正参数 / 改用 releaseAllTextures 即可恢复。
 */
export class FramebufferReleaseError extends FramebufferError {
  constructor(
    width: number,
    height: number,
    options: {
      reason: string
      context?: ErrorContext
      cause?: Error
    }
  ) {
    super(options.reason, 'FBO_RELEASE_INVALID', {
      width,
      height,
      recoverable: true,
      context: options.context,
      cause: options.cause
    })
  }

  override toUserMessage(): string {
    return `帧缓冲纹理释放失败（${this.width}x${this.height}）：${this.message}`
  }
}
