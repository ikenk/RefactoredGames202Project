import { FramebufferError } from './BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

export class FramebufferCreationError extends FramebufferError {
  constructor(
    width: number,
    height: number,
    options?: {
      reason?: string
      context?: ErrorContext
      cause?: Error
    }
  ) {
    const message = options?.reason ?? `gl.createFramebuffer() returned null (${width}x${height})`
    super(message, 'FBO_CREATION_FAILED', {
      width,
      height,
      recoverable: false,
      context: options?.context,
      cause: options?.cause
    })
  }
}
