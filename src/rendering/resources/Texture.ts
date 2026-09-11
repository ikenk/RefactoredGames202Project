import { Resource } from '@/rendering/core/Resource'

/** 纹理坐标超出 [0, 1] 时的采样行为。 */
export type TextureWrapMode = 'clamp-to-edge' | 'repeat' | 'mirrored-repeat'

/** 放大过滤不涉及 mipmap，只支持最近点或线性采样。 */
export type TextureMagFilter = 'nearest' | 'linear'

/** 缩小过滤可以选择 base level 或 mipmap chain。 */
export type TextureMinFilter =
  | 'nearest'
  | 'linear'
  | 'nearest-mipmap-nearest'
  | 'linear-mipmap-nearest'
  | 'nearest-mipmap-linear'
  | 'linear-mipmap-linear'

/**
 * 当前 CPU Texture 资源支持的逻辑像素通道布局。
 *
 * @remarks
 * backend 负责把逻辑 format 映射为 WebGL1/WebGL2 的 format/internalFormat。
 */
export type TextureFormat = 'r' | 'rg' | 'rgb' | 'rgba'

/**
 * 当前 CPU Texture 资源支持的像素标量类型。
 *
 * @remarks
 * uint8 覆盖普通 PNG/JPEG 等 LDR 图像；float32 覆盖 HDR/EXR 解码后的线性数据。
 */
export type TextureDataType = 'uint8' | 'float32'

/** 纹理数据采用的颜色空间语义。 */
export type TextureColorSpace = 'srgb' | 'linear' | 'data'

/**
 * source texture 的 mipmap 所有权策略。
 *
 * @remarks
 * `none` 表示只存在 base level；`generate` 表示上传 base level 后由 backend
 * 生成 mip chain。
 *
 * EnvironmentBakePipeline 输出的手工 roughness mip chain 属于未来 RenderTarget
 * attachment/GPU binding，而不是这里的 source texture 自动生成策略。
 */
export type TextureMipmapPolicy = 'none' | 'generate'

/** 可选的 sampler 构造输入。 */
export interface TextureSamplerInput {
  readonly wrapS?: TextureWrapMode
  readonly wrapT?: TextureWrapMode
  readonly minFilter?: TextureMinFilter
  readonly magFilter?: TextureMagFilter
}

/** 经过默认值填充和验证的不可变 sampler 描述。 */
export interface TextureSamplerDescriptor {
  readonly wrapS: TextureWrapMode
  readonly wrapT: TextureWrapMode
  readonly minFilter: TextureMinFilter
  readonly magFilter: TextureMagFilter
}

/** 与 CPU 像素数组相对应的逻辑存储描述。 */
export interface TextureStorageDescriptor {
  readonly format: TextureFormat
  readonly type: TextureDataType
}

/** 所有逻辑 Texture 子类共享的构造字段。 */
export interface TextureOptions {
  /**
   * 稳定、可重复的开发者诊断标签。
   *
   * @remarks
   * label 不是唯一 ID，也不是 Manager cache key。Manager 应使用 Texture 对象身份。
   */
  readonly label: string

  readonly sampler?: TextureSamplerInput
  readonly storage: TextureStorageDescriptor
  readonly colorSpace: TextureColorSpace
  readonly mipmapPolicy?: TextureMipmapPolicy
}

/**
 * Texture 子类提供的领域错误工厂。
 *
 * @remarks
 * 通用 Texture 基类负责共享验证，但错误类型仍由具体资源决定：
 *
 * - ImageTexture2D/DataTexture2D 使用 InvalidTextureSourceError；
 * - CubeTexture 使用 InvalidCubeTextureError。
 */
export type TextureValidationErrorFactory = (reason: string) => Error

/** 经过验证的完整 Texture descriptor snapshot。 */
export interface TextureDescriptorSnapshot {
  readonly label: string
  readonly sampler: Readonly<TextureSamplerDescriptor>
  readonly storage: Readonly<TextureStorageDescriptor>
  readonly colorSpace: TextureColorSpace
  readonly mipmapPolicy: TextureMipmapPolicy
}

const WRAP_MODES: ReadonlySet<string> = new Set(['clamp-to-edge', 'repeat', 'mirrored-repeat'])

const MAG_FILTERS: ReadonlySet<string> = new Set(['nearest', 'linear'])

const MIN_FILTERS: ReadonlySet<string> = new Set([
  'nearest',
  'linear',
  'nearest-mipmap-nearest',
  'linear-mipmap-nearest',
  'nearest-mipmap-linear',
  'linear-mipmap-linear'
])

const MIPMAP_MIN_FILTERS: ReadonlySet<string> = new Set([
  'nearest-mipmap-nearest',
  'linear-mipmap-nearest',
  'nearest-mipmap-linear',
  'linear-mipmap-linear'
])

const FORMATS: ReadonlySet<string> = new Set(['r', 'rg', 'rgb', 'rgba'])

const DATA_TYPES: ReadonlySet<string> = new Set(['uint8', 'float32'])

const COLOR_SPACES: ReadonlySet<string> = new Set(['srgb', 'linear', 'data'])

const MIPMAP_POLICIES: ReadonlySet<string> = new Set(['none', 'generate'])

/**
 * 验证、复制并冻结通用 Texture descriptor。
 *
 * @internal
 */
export function createTextureDescriptorSnapshot(
  options: TextureOptions,
  createError: TextureValidationErrorFactory
): TextureDescriptorSnapshot {
  if (typeof options.label !== 'string' || options.label.trim().length === 0) {
    throw createError('label must be a non-empty string')
  }

  if (
    options.sampler !== undefined &&
    (options.sampler === null || typeof options.sampler !== 'object')
  ) {
    throw createError('sampler must be an object when provided')
  }

  if (options.storage === null || typeof options.storage !== 'object') {
    throw createError('storage must be an object')
  }

  // ----- sampler -----
  const samplerInput = options.sampler ?? {}
  const wrapS = samplerInput.wrapS ?? 'clamp-to-edge'
  const wrapT = samplerInput.wrapT ?? 'clamp-to-edge'
  const minFilter = samplerInput.minFilter ?? 'linear'
  const magFilter = samplerInput.magFilter ?? 'linear'

  // ----- storage -----
  const format = options.storage.format
  const type = options.storage.type

  // ----- colorSpace -----
  const colorSpace = options.colorSpace

  // ----- mipmapPolicy -----
  const mipmapPolicy = options.mipmapPolicy ?? 'none'

  if (!WRAP_MODES.has(wrapS)) {
    throw createError(`unsupported wrapS ${String(wrapS)}`)
  }

  if (!WRAP_MODES.has(wrapT)) {
    throw createError(`unsupported wrapT ${String(wrapT)}`)
  }

  if (!MIN_FILTERS.has(minFilter)) {
    throw createError(`unsupported minFilter ${String(minFilter)}`)
  }

  if (!MAG_FILTERS.has(magFilter)) {
    throw createError(`unsupported magFilter ${String(magFilter)}`)
  }

  if (!FORMATS.has(format)) {
    throw createError(`unsupported format ${String(format)}`)
  }

  if (!DATA_TYPES.has(type)) {
    throw createError(`unsupported data type ${String(type)}`)
  }

  if (!COLOR_SPACES.has(colorSpace)) {
    throw createError(`unsupported color space ${String(colorSpace)}`)
  }

  if (!MIPMAP_POLICIES.has(mipmapPolicy)) {
    throw createError(`unsupported mipmap policy ${String(mipmapPolicy)}`)
  }

  if (mipmapPolicy === 'none' && MIPMAP_MIN_FILTERS.has(minFilter)) {
    throw createError(`minFilter ${minFilter} requires mipmapPolicy "generate"`)
  }

  const sampler: TextureSamplerDescriptor = Object.freeze({
    wrapS,
    wrapT,
    minFilter,
    magFilter
  })

  const storage: TextureStorageDescriptor = Object.freeze({
    format,
    type
  })

  return Object.freeze({
    label: options.label,
    sampler,
    storage,
    colorSpace,
    mipmapPolicy
  })
}

/**
 * 所有 CPU 逻辑纹理资源共享的抽象基类。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][texture-cpu-gpu-boundary]
 *
 * Texture 保存 backend-independent 的 source 描述、sampler、storage、color space
 * 和 mipmap policy。它不保存 WebGLTexture，也不执行 WebGL1 NPOT 验证。
 *
 * WebGL1 和 WebGL2 Manager 可以为同一个 Texture 对象分别创建两个不同的
 * context-local GPU 表示。
 */
export abstract class Texture extends Resource {
  public readonly label: string
  public readonly sampler: Readonly<TextureSamplerDescriptor>
  public readonly storage: Readonly<TextureStorageDescriptor>
  public readonly colorSpace: TextureColorSpace
  public readonly mipmapPolicy: TextureMipmapPolicy

  /**
   * @param options - 通用纹理描述。
   * @param createError - 由具体子类提供的领域错误工厂。
   */
  /**
   * @param options - 通用纹理描述。
   * @param createError - 由具体子类提供的领域错误工厂。
   */
  protected constructor(options: TextureOptions, createError: TextureValidationErrorFactory) {
    super()

    const descriptor = createTextureDescriptorSnapshot(options, createError)

    this.label = descriptor.label
    this.sampler = descriptor.sampler
    this.storage = descriptor.storage
    this.colorSpace = descriptor.colorSpace
    this.mipmapPolicy = descriptor.mipmapPolicy
  }
}
