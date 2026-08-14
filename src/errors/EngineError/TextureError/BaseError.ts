import { EngineError } from '../BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * 纹理错误基类
 *
 * @remarks
 * 用于所有纹理相关的错误：
 * - 格式错误（InvalidTextureFormatError）
 * - 创建失败（TextureCreationError）
 * - 加载失败（TextureLoadError）
 * - 上传失败（TextureUploadError）
 *
 * @example
 * ```ts
 * class TextureFormatError extends TextureError {
 *   constructor(message: string, context?: Record<string, any>) {
 *     super(message, 'TEX_FORMAT_ERROR', {
 *       textureType: 'TEXTURE_2D',
 *       context,
 *       recoverable: false
 *     })
 *   }
 * }
 * ```
 */
export class TextureError extends EngineError {
  /**
   * 纹理类型
   * @example 'TEXTURE_2D', 'TEXTURE_CUBE_MAP'
   */
  public readonly textureType?: string

  constructor(
    message: string,
    code: string,
    options: {
      textureType?: string
      context?: ErrorContext
      recoverable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, {
      context: {
        textureType: options.textureType,
        ...options.context
      },
      recoverable: options.recoverable,
      cause: options.cause
    })

    this.textureType = options.textureType
  }

  override toUserMessage(): string {
    return '纹理处理失败，请检查纹理文件格式和尺寸。'
  }
}
