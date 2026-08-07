import type { ShaderErrorKind } from '@/shaders/types/Shader'
import { ShaderError } from './BaseError'

export class ShaderLinkError extends ShaderError {
  constructor(shaderPath: string, shaderType: ShaderErrorKind) {
    const message = 'shader program link failed'

    super(message, 'SHADER_LINK_FAILED', {
      shaderPath,
      shaderType
    })
  }

  override toUserMessage(): string {
    return '着色器程序链接失败。'
  }
}
