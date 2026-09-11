import { RenderingError, type RenderingErrorDetails } from './RenderingError'

/**
 * 表示 CubeTexture 的六面 source 或通用纹理描述无效。
 */
export class InvalidCubeTextureError extends RenderingError {
  /**
   * @param textureLabel - CubeTexture 的稳定诊断标签。
   * @param reason - 违反的具体构造约束。
   * @param details - 可选的额外结构化诊断信息。
   */
  constructor(textureLabel: string, reason: string, details: RenderingErrorDetails = {}) {
    super(`Cube texture ${textureLabel} is invalid: ${reason}`, 'INVALID_CUBE_TEXTURE', {
      ...details,
      textureLabel,
      reason
    })
  }
}
