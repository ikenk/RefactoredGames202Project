import { EngineError } from '../BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

export class FramebufferError extends EngineError {
  public readonly width: number
  public readonly height: number

  constructor(
    message: string,
    code: string,
    options: {
      width: number
      height: number
      context?: ErrorContext
      recoverable?: boolean
      cause?: Error
    }
  ) {
    super(message, code, {
      context: {
        width: options.width,
        height: options.height,
        ...options.context
      },
      recoverable: options.recoverable,
      cause: options.cause
    })

    this.width = options.width
    this.height = options.height
  }

  override toUserMessage(): string {
    return `帧缓冲操作失败（${this.width}x${this.height}），可能是 GPU 资源不足。`
  }
}
