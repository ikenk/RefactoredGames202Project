import { InvalidTextureSourceError } from '@/rendering/core/errors'
import {
  Texture,
  type TextureOptions,
  type TextureValidationErrorFactory
} from '@/rendering/resources/Texture'
import {
  copyTexturePixelSnapshot2D,
  createTexturePixelSnapshot2D,
  type TexturePixelSnapshot2D,
  type TexturePixelSource2D
} from '@/rendering/resources/texturePixelSnapshot'

/**
 * 浏览器可以作为普通二维图片来源的对象。
 *
 * @remarks
 * 当前不纳入 HTMLCanvasElement、HTMLVideoElement 或 VideoFrame，因为本阶段资源
 * 是静态 Texture。需要动态上传时应单独引入 version/update 契约。
 */
export type TextureImageSource = HTMLImageElement | ImageBitmap

/** ImageTexture2D 的完整构造输入。 */
export interface ImageTexture2DOptions extends TextureOptions {
  readonly source: TextureImageSource
}

/** DataTexture2D 的完整构造输入。 */
export interface DataTexture2DOptions extends TextureOptions {
  readonly source: TexturePixelSource2D
}

/** 为无效 label 建立仍然可读的错误上下文。 */
function getTextureDiagnosticLabel(label: unknown): string {
  if (typeof label !== 'string' || label.trim().length === 0) {
    return '<unnamed>'
  }

  return label
}

/**
 * 普通二维 Texture 的抽象分类节点。
 *
 * @remarks
 * Texture2D 本身没有 source 存储方式。ImageTexture2D 保存浏览器图片引用，
 * DataTexture2D 保存 TypedArray snapshot。
 */
export abstract class Texture2D extends Texture {
  protected constructor(options: TextureOptions, createError: TextureValidationErrorFactory) {
    super(options, createError)
  }
}

/**
 * 由已解码浏览器图片提供像素的二维纹理资源。
 *
 * @remarks
 * [DESIGN-WEIGHT:2][image-texture-borrowed-source]
 *
 * HTMLImageElement/ImageBitmap 不能像 TypedArray 一样通用地深拷贝，因此资源保存
 * 原始对象引用。ImageTexture2D.dispose() 只断开引用，不调用 ImageBitmap.close()；
 * source 的浏览器生命周期仍由创建它的调用者负责。
 *
 * 具体对象是否已加载、是否仍有效以及能否传给 texImage2D，由 backend manager
 * 在真正上传时验证。
 */
export class ImageTexture2D extends Texture2D {
  protected override readonly resourceType: string = 'ImageTexture2D'

  private sourceValue: TextureImageSource | null

  constructor(options: ImageTexture2DOptions) {
    const textureLabel = getTextureDiagnosticLabel(options.label)

    super(options, (reason) => {
      return new InvalidTextureSourceError(textureLabel, reason)
    })

    if (options.source === null || typeof options.source !== 'object') {
      throw new InvalidTextureSourceError(this.label, 'image source must be an object')
    }

    this.sourceValue = options.source
  }

  /** 获取构造时保存的浏览器图片引用。 */
  get source(): TextureImageSource {
    this.assertUsable()

    return this.sourceValue!
  }

  /**
   * 断开图片引用，但不取得或终止外部图片对象的生命周期。
   */
  protected override disposeCPUData(): void {
    this.sourceValue = null
  }
}

/**
 * 由 Uint8Array 或 Float32Array 提供像素的二维纹理资源。
 *
 * @remarks
 * HDR/EXR loader 应先把文件解析为 Float32Array、width 和 height，再构造
 * DataTexture2D。ShaderModule 不参与文件格式解析。
 */
export class DataTexture2D extends Texture2D {
  protected readonly resourceType = 'DataTexture2D'

  private sourceValue: TexturePixelSnapshot2D | null

  constructor(options: DataTexture2DOptions) {
    const textureLabel = getTextureDiagnosticLabel(options.label)

    super(options, (reason) => new InvalidTextureSourceError(textureLabel, reason))

    this.sourceValue = createTexturePixelSnapshot2D(
      options.source,
      this.storage,
      (reason) => new InvalidTextureSourceError(this.label, reason)
    )
  }

  /** 获取像素宽度。 */
  get width(): number {
    this.assertUsable()

    return this.sourceValue!.width
  }

  /** 获取像素高度。 */
  get height(): number {
    this.assertUsable()

    return this.sourceValue!.height
  }

  /**
   * 复制完整二维像素 source。
   *
   * @returns wrapper 和 TypedArray 都是新对象。
   */
  copySource(): TexturePixelSource2D {
    this.assertUsable()

    return copyTexturePixelSnapshot2D(this.sourceValue!)
  }

  /** 断开内部 TypedArray snapshot。 */
  protected disposeCPUData(): void {
    this.sourceValue = null
  }
}
