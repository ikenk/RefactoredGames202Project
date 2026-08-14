import { EngineError } from '../BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * 配置错误基类
 */
export class ConfigurationError extends EngineError {
  // public readonly configKey: string
  // public readonly expectedType: string

  // constructor(configKey: string, expectedType: string, actualValue: any) {
  //   super(
  //     `Invalid configuration: ${configKey} (expected ${expectedType}, got ${typeof actualValue})`,
  //     'INVALID_CONFIG',
  //     {
  //       context: {
  //         configKey,
  //         expectedType,
  //         actualValue
  //       },
  //       recoverable: false
  //     }
  //   )

  //   this.configKey = configKey
  //   this.expectedType = expectedType
  // }

  public readonly configPath?: string

  constructor(
    message: string,
    code: string,
    options: {
      configPath?: string
      context?: ErrorContext
      cause?: Error
    } = {}
  ) {
    super(message, code, {
      context: { configPath: options.configPath, ...options.context },
      recoverable: false,
      cause: options.cause
    })

    this.configPath = options.configPath
  }
}
