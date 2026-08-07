import type { ShaderStage } from '@/shaders/types/Shader'
import { ShaderError } from './BaseError'

export class ShaderCreationError extends ShaderError {
  constructor(shaderType: ShaderStage, shaderPath?: string) {
    const message = `${shaderType} shader creation failed`
    super(message, 'SHADER_CREATION_FAILED', {
      shaderPath: shaderPath ?? '',
      shaderType
    })
  }

  override toUserMessage(): string {
    return `创建 ${this.shaderType} 着色器失败。`
  }
}
