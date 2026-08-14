import { EngineError } from '../BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * 资源错误基类
 *
 * @remarks
 * 用于所有资源加载、解析、验证相关的错误
 *
 * 使用场景：
 * - 文件加载失败（404、网络错误）
 * - 资源解析失败（格式不正确）
 * - 资源验证失败（数据不符合要求）
 *
 * @example
 * ```ts
 * class TextureLoadError extends ResourceError {
 *   constructor(path: string, cause?: Error) {
 *     super('Texture', path, 'Failed to load texture', 'TEXTURE_LOAD_FAILED', {
 *       recoverable: true,
 *       cause
 *     })
 *   }
 * }
 * ```
 */
export class ResourceError extends EngineError {
  /**
   * 资源类型
   * @example 'model', 'image', 'audio', 'video', 'font', 'model', 'hdr', 'gltf'
   */
  // public readonly resourceType: ResourceType
  public readonly resourceType: string

  /**
   * 资源路径或标识符
   * @example '/textures/env.hdr', 'https://cdn.example.com/model.gltf'
   */
  public readonly resourcePath: string

  constructor(
    resourceType: string,
    resourcePath: string,
    message: string,
    code: string,
    options: {
      context?: ErrorContext
      recoverable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, {
      context: {
        resourceType,
        resourcePath,
        ...options.context
      },
      recoverable: options.recoverable ?? true, // 资源错误通常可以重试
      cause: options.cause
    })
    this.resourceType = resourceType
    this.resourcePath = resourcePath
  }
}
