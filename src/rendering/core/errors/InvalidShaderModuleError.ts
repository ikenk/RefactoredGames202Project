import { RenderingError, type RenderingErrorDetails } from './RenderingError'

/**
 * 表示 ShaderModule 的语言、源码或逻辑绑定描述无效。
 */
export class InvalidShaderModuleError extends RenderingError {
  /**
   * @param shaderName - ShaderModule 的稳定诊断名称。
   * @param reason - 违反的具体构造约束。
   * @param details - 可选的额外结构化诊断信息。
   */
  constructor(shaderName: string, reason: string, details: RenderingErrorDetails = {}) {
    super(`Shader module ${shaderName} is invalid: ${reason}`, 'INVALID_SHADER_MODULE', {
      ...details,
      shaderName,
      reason
    })
  }
}
