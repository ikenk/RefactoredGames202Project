import { EngineError } from '../BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

export abstract class LightError extends EngineError {
  constructor(
    message: string,
    code: string,
    options: { context?: ErrorContext; recoverable?: boolean; cause?: Error } = {}
  ) {
    super(message, code, options)
  }
}
