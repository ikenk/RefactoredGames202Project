import { EngineError } from '../BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * WebGL 错误基类
 */
export class WebGLError extends EngineError {
  public readonly webglStatusCode: string

  constructor(
    message: string,
    code: string,
    options: {
      context?: ErrorContext
      recoverable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, options)

    this.webglStatusCode = code
  }
}
