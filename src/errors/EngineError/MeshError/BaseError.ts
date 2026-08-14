import { EngineError } from '../BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

export class MeshError extends EngineError {
  public readonly meshName: string

  constructor(
    message: string,
    code: string,
    meshName: string,
    options: {
      context?: ErrorContext
      cause?: Error
      recoverable?: boolean
    }
  ) {
    super(message, code, {
      context: {
        meshName: meshName,
        ...options.context
      },
      recoverable: options.recoverable,
      cause: options.cause
    })

    this.meshName = meshName
  }
}
