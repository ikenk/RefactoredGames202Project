import { ResourceError } from './BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * 资源加载错误（仅用于外部用户资源）
 *
 * 使用场景：
 * - GLTF 模型加载失败
 * - 图片文件加载失败
 * - 音频/视频文件加载失败
 * - 字体文件加载失败
 *
 * 不包括：
 * - Shader 文件（使用 ShaderLoadError）
 * - HDR/EXR 纹理（使用 TextureLoadError）
 * - 配置文件（使用 ConfigLoadError）
 */
export class ResourceLoadError extends ResourceError {
  constructor(resourceType: string, resourcePath: string, context?: ErrorContext, cause?: Error) {
    super(
      resourceType,
      resourcePath,
      `Failed to load ${resourceType}: ${resourcePath}`,
      'RESOURCE_LOAD_FAILED',
      {
        context: {
          resourceType,
          resourcePath,
          ...context
        },
        recoverable: false,
        cause
      }
    )
  }

  override toUserMessage(): string {
    const typeNames: Record<string, string> = {
      model: '模型',
      gltf: 'GLTF模型',
      image: '图片',
      audio: '音频',
      video: '视频',
      font: '字体'
    }

    const typeName = typeNames[this.resourceType] ?? this.resourceType
    return `加载${typeName}失败：${this.resourcePath}`
  }
}
