import type { ShaderErrorKind } from '@/shaders/types/Shader'
import { EngineError } from '../BaseError'

/**
 * Shader 错误基类
 */
export class ShaderError extends EngineError {
  public readonly shaderPath: string
  public readonly shaderType: ShaderErrorKind

  constructor(
    message: string,
    code: string,
    options: {
      shaderPath: string
      shaderType: ShaderErrorKind
      context?: Record<string, any>
      recoverable?: boolean
      cause?: Error
    }
  ) {
    super(message, code, {
      context: {
        shaderPath: options.shaderPath,
        shaderType: options.shaderType,
        ...options.context
      },
      recoverable: options.recoverable ?? false,
      cause: options.cause
    })

    this.shaderPath = options.shaderPath
    this.shaderType = options.shaderType
  }

  override toUserMessage(): string {
    const typeNames = {
      vertex: '顶点着色器',
      fragment: '片段着色器',
      compute: '计算着色器',
      program: '着色器程序'
    }

    const typeName = this.shaderType ? typeNames[this.shaderType] : '着色器'
    return `${typeName}处理失败`
  }
}
