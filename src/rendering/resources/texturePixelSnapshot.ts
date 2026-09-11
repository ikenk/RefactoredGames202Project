import type { TextureFormat, TextureStorageDescriptor } from '@/rendering/resources/Texture'

/** 当前 CPU pixel texture 支持的像素数组类型。 */
export type TexturePixelArray = Uint8Array | Float32Array

/** 调用者提供的一份二维像素来源。 */
export interface TexturePixelSource2D {
  readonly data: TexturePixelArray
  readonly width: number
  readonly height: number
}

/**
 * Texture 内部保存的二维像素快照。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][texture-pixel-snapshot-ownership]
 *
 * `readonly` 只能阻止重新赋值 `data` 属性，不能阻止修改 TypedArray 的元素。
 * 因此创建快照时必须复制 TypedArray，读取时也必须再次返回副本，不能把这里保存的
 * `data` 直接暴露给调用者。
 */
export interface TexturePixelSnapshot2D {
  readonly data: TexturePixelArray
  readonly width: number
  readonly height: number
}

/** 像素来源验证失败时由具体 Texture 提供领域错误。 */
export type TexturePixelValidationErrorFactory = (reason: string) => Error

/**
 * 返回一种逻辑像素格式所包含的标量通道数。
 *
 * @example
 * `rgba` 的一个像素包含四个标量，因此 2 × 3 的图片需要 `2 * 3 * 4` 个数组元素。
 */
function getChannelCount(format: TextureFormat): number {
  const channelCounts: Readonly<Record<TextureFormat, number>> = {
    r: 1,
    rg: 2,
    rgb: 3,
    rgba: 4
  }

  return channelCounts[format]
}

/**
 * 创建具有独立 backing storage 的同类型像素数组。
 *
 * @remarks
 * `new Uint8Array(existing)` 与 `new Float32Array(existing)` 会逐元素复制数据，
 * 新旧 TypedArray 不共享同一个 `ArrayBuffer`。这样调用者随后修改原数组时，
 * Texture 内部的像素快照不会随之改变。
 */
function copyTexturePixelArray(data: TexturePixelArray): TexturePixelArray {
  if (data instanceof Uint8Array) {
    return new Uint8Array(data)
  }

  if (data instanceof Float32Array) {
    return new Float32Array(data)
  }

  throw new TypeError('Unsupported texture pixel array')
}

/**
 * 验证调用者提供的二维像素来源，并创建具有独立 TypedArray 的内部快照。
 *
 * @param source - 尚未信任的二维像素 wrapper、尺寸与像素数组。
 * @param storage - 已由 Texture 基类验证的逻辑像素格式和标量类型。
 * @param createError - 把通用验证原因转换为具体 Texture 领域错误的惰性工厂。
 * @returns wrapper 与 TypedArray 都独立于调用者输入的内部快照。
 *
 * @throws 调用者提供的领域错误
 * source 结构、宽高、数组类型或数组长度违反约束时抛出。
 *
 * @internal
 */
export function createTexturePixelSnapshot2D(
  source: TexturePixelSource2D,
  storage: TextureStorageDescriptor,
  createError: TexturePixelValidationErrorFactory
): TexturePixelSnapshot2D {
  if (source === null || typeof source !== 'object') {
    throw createError('pixel source must be an object')
  }

  if (
    !Number.isInteger(source.width) ||
    source.width <= 0 ||
    !Number.isInteger(source.height) ||
    source.height <= 0
  ) {
    throw createError(
      `width and height must be positive integers; received ${String(source.width)} × ${String(source.height)}`
    )
  }

  const hasSupportedArray = source.data instanceof Uint8Array || source.data instanceof Float32Array

  if (!hasSupportedArray) {
    throw createError('data must be a Uint8Array or Float32Array')
  }

  if (storage.type === 'uint8' && !(source.data instanceof Uint8Array)) {
    throw createError('storage type uint8 requires Uint8Array data')
  }

  if (storage.type === 'float32' && !(source.data instanceof Float32Array)) {
    throw createError('storage type float32 requires Float32Array data')
  }

  const expectedLength = source.width * source.height * getChannelCount(storage.format)

  if (!Number.isSafeInteger(expectedLength)) {
    throw createError('texture dimensions exceed the safe CPU array length range')
  }

  if (source.data.length !== expectedLength) {
    throw createError(
      `data length ${source.data.length} does not match expected length ${expectedLength}`
    )
  }

  return Object.freeze({
    data: copyTexturePixelArray(source.data),
    width: source.width,
    height: source.height
  })
}

/**
 * 从内部二维像素快照创建一份可安全交给调用者的新副本。
 *
 * @param source - 已经通过验证、只在 Texture 内部保存的像素快照。
 * @returns 新 wrapper 以及具有独立 `ArrayBuffer` 的新 TypedArray。
 *
 * @remarks
 * 这里不重复构造阶段的格式和尺寸验证，因为参数语义明确要求它是内部已验证快照。
 * 重新验证既不能增加边界安全性，也会把只需复制的热路径和构造校验混在一起。
 *
 * @internal
 */
export function copyTexturePixelSnapshot2D(source: TexturePixelSnapshot2D): TexturePixelSource2D {
  return {
    data: copyTexturePixelArray(source.data),
    width: source.width,
    height: source.height
  }
}
