import type { ShaderStage } from '@/shaders/types/Shader'
import { ShaderError } from './BaseError'

export class ShaderLoadError extends ShaderError {
  public readonly statusCode?: number

  constructor(
    shaderPath: string,
    shaderType: ShaderStage,
    context?: {
      reason?: string
      statusCode?: number
      timeout?: number
    }
  ) {
    const message = `Failed to load shader from: ${shaderPath}`

    super(message, 'SHADER_LOAD_FAILED', {
      shaderPath,
      shaderType,
      context
    })

    this.statusCode = context?.statusCode
  }

  override toUserMessage(): string {
    const typeNames = {
      vertex: '顶点着色器',
      fragment: '片段着色器',
      compute: '计算着色器'
    }

    const typeName = this.shaderType === 'program' ? '着色器程序' : typeNames[this.shaderType]

    if (this.statusCode === 404) {
      return `找不到${typeName}文件：${this.shaderPath}`
    }

    if (this.statusCode && this.statusCode >= 500) {
      return `服务器错误，无法加载${typeName}：${this.shaderPath}`
    }

    if (this.context?.timeout) {
      return `加载${typeName}超时（${this.context.timeout}ms）：${this.shaderPath}`
    }

    return `加载${typeName}失败：${this.shaderPath}`
  }
}
