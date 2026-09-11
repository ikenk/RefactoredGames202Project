import { assertNever } from '@/errors/helper/helpers'
import { InvalidCubeTextureError } from '@/rendering/core/errors'
import {
  Texture,
  type TextureOptions,
  type TextureStorageDescriptor
} from '@/rendering/resources/Texture'
import {
  copyTexturePixelSnapshot2D,
  createTexturePixelSnapshot2D,
  type TexturePixelSnapshot2D,
  type TexturePixelSource2D
} from '@/rendering/resources/texturePixelSnapshot'
import type { TextureImageSource } from '@/rendering/resources/Texture2D'

/**
 * 固定按 +X、-X、+Y、-Y、+Z、-Z 顺序排列的 cubemap 六面。
 *
 * @remarks
 * tuple 只提供编译期长度约束；构造函数仍会验证运行时数组长度。
 */
export type CubeFaces<T> = readonly [T, T, T, T, T, T]

/** 六张浏览器图片组成的 cubemap source。 */
export interface CubeImageSource {
  readonly kind: 'images'
  readonly faces: CubeFaces<TextureImageSource>
}

/** 六张同尺寸像素数组组成的 cubemap source。 */
export interface CubeDataSource {
  readonly kind: 'data'
  readonly faces: CubeFaces<TexturePixelSource2D>
}

/** CubeTexture 支持的两种 CPU source 表示。 */
export type CubeTextureSource = CubeImageSource | CubeDataSource

/** CubeTexture 的完整构造输入。 */
export interface CubeTextureOptions extends TextureOptions {
  readonly source: CubeTextureSource
}

interface CubeImageSnapshot {
  readonly kind: 'images'
  readonly faces: CubeFaces<TextureImageSource>
}

interface CubeDataSnapshot {
  readonly kind: 'data'
  readonly faces: CubeFaces<TexturePixelSnapshot2D>
}

type CubeTextureSourceSnapshot = CubeImageSnapshot | CubeDataSnapshot

function getCubeDiagnosticLabel(label: unknown): string {
  if (typeof label !== 'string' || label.trim().length === 0) {
    return '<unnamed>'
  }

  return label
}

/** 复制并冻结一个已经验证为六个元素的数组。 */
function copyCubeFaces<T>(faces: CubeFaces<T>): CubeFaces<T> {
  const copiedFaces: CubeFaces<T> = [faces[0], faces[1], faces[2], faces[3], faces[4], faces[5]]

  return Object.freeze(copiedFaces)
}

/**
 * 验证并复制 image cubemap source。
 *
 * @param label - CubeTexture 的稳定诊断标签。
 * @param source - 声明为 `kind: 'images'` 的六面输入。
 * @returns 已复制并冻结 faces 容器的内部 snapshot。
 *
 * @throws {@link InvalidCubeTextureError}
 * faces 不是六元素数组，或某个 face 不是非空对象时抛出。
 *
 * @remarks
 * [DESIGN-WEIGHT:2][cubemap-borrowed-image-source]
 *
 * 此处只验证 backend-independent 的最小结构。图片是否已经加载、是否确实可以
 * 传给 texImage2D、六面是否同尺寸以及 WebGL1 NPOT 限制，由后续
 * WebGL1CubeTextureManager 在上传时验证。
 */
function createCubeImageSnapshot(label: string, source: CubeImageSource): CubeImageSnapshot {
  /*
   * 对 unknown 别名调用 Array.isArray()，避免 TypeScript 把 source.faces
   * 收窄成 `CubeFaces<TextureImageSource> & any[]`。
   */
  const rawFaces: unknown = source.faces

  if (!Array.isArray(rawFaces) || rawFaces.length !== 6) {
    const receivedFaceCount = Array.isArray(rawFaces) ? rawFaces.length : 'non-array'

    throw new InvalidCubeTextureError(
      label,
      `image source must contain exactly 6 faces; received ${String(receivedFaceCount)}`,
      {
        expectedFaceCount: 6,
        receivedFaceCount
      }
    )
  }

  /*
   * 运行时验证已经通过 rawFaces 确认数组长度；这里继续使用原本的 tuple 类型，
   * 不让 Array.isArray() 的 `any[]` 类型谓词污染元素类型。
   */
  const faces = source.faces

  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    const face = faces[faceIndex]

    if (face === null || typeof face !== 'object') {
      throw new InvalidCubeTextureError(label, `image face ${faceIndex} must be an object`, {
        faceIndex
      })
    }
  }

  return Object.freeze({
    kind: 'images',
    faces: copyCubeFaces(faces)
  })
}

/**
 * 验证并复制一个 data cubemap face。
 *
 * @param label - CubeTexture 的稳定诊断标签。
 * @param face - 调用者提供的一面二维像素数据。
 * @param faceIndex - 当前面的固定 cubemap 索引。
 * @param storage - 已由 Texture 基类验证的像素存储描述。
 * @returns wrapper 和 TypedArray 都已经复制的内部 snapshot。
 *
 * @throws {@link InvalidCubeTextureError}
 * face 的尺寸、数组类型或数据长度无效时抛出。
 */
function createCubeDataFaceSnapshot(
  label: string,
  face: TexturePixelSource2D,
  faceIndex: number,
  storage: TextureStorageDescriptor
): TexturePixelSnapshot2D {
  return createTexturePixelSnapshot2D(
    face,
    storage,
    (reason) =>
      new InvalidCubeTextureError(label, `data face ${faceIndex} is invalid: ${reason}`, {
        faceIndex
      })
  )
}

/**
 * 验证、复制并冻结 data cubemap 的六个 face。
 *
 * @param label - CubeTexture 的稳定诊断标签。
 * @param source - 声明为 `kind: 'data'` 的六面输入。
 * @param storage - 已由 Texture 基类验证的像素存储描述。
 * @returns 六个 wrapper 和六个 TypedArray 均独立于调用者输入的内部 snapshot。
 *
 * @throws {@link InvalidCubeTextureError}
 * faces 不是六元素数组、单面像素数据无效，或六面宽高不一致时抛出。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][cubemap-data-face-consistency]
 *
 * Cubemap 的六面共享同一个 GPU storage，因此必须具有相同宽高。这里验证的是
 * backend-independent 的 cubemap 结构不变量；WebGL1 的 NPOT、format 支持和
 * mipmap 能力仍由 WebGL1CubeTextureManager 验证。
 */
function createCubeDataSnapshot(
  label: string,
  source: CubeDataSource,
  storage: TextureStorageDescriptor
): CubeDataSnapshot {
  const rawFaces: unknown = source.faces

  if (!Array.isArray(rawFaces) || rawFaces.length !== 6) {
    const receivedFaceCount = Array.isArray(rawFaces) ? rawFaces.length : 'non-array'

    throw new InvalidCubeTextureError(
      label,
      `data source must contain exactly 6 faces; received ${String(receivedFaceCount)}`,
      {
        expectedFaceCount: 6,
        receivedFaceCount
      }
    )
  }

  const faces = source.faces
  const snapshots: CubeFaces<TexturePixelSnapshot2D> = [
    createCubeDataFaceSnapshot(label, faces[0], 0, storage),
    createCubeDataFaceSnapshot(label, faces[1], 1, storage),
    createCubeDataFaceSnapshot(label, faces[2], 2, storage),
    createCubeDataFaceSnapshot(label, faces[3], 3, storage),
    createCubeDataFaceSnapshot(label, faces[4], 4, storage),
    createCubeDataFaceSnapshot(label, faces[5], 5, storage)
  ]

  const firstFace = snapshots[0]

  snapshots.slice(1).forEach((face, offset) => {
    const faceIndex = offset + 1

    if (face.width !== firstFace.width || face.height !== firstFace.height) {
      throw new InvalidCubeTextureError(
        label,
        `data face ${faceIndex} dimensions ${face.width} × ${face.height} do not match face 0 dimensions ${firstFace.width} × ${firstFace.height}`,
        {
          faceIndex,
          expectedWidth: firstFace.width,
          expectedHeight: firstFace.height,
          receivedWidth: face.width,
          receivedHeight: face.height
        }
      )
    }
  })

  return Object.freeze({
    kind: 'data',
    faces: Object.freeze(snapshots)
  })
}

/**
 * 按 discriminant 验证并创建 cubemap source snapshot。
 *
 * @remarks
 * 参数的静态类型虽然是 union，但 JSON、JavaScript 或 `as never` 仍可绕过编译期
 * 约束，所以入口必须把 `kind` 当作未知运行时值重新验证。
 */
function createCubeSourceSnapshot(
  label: string,
  source: CubeTextureSource,
  storage: TextureStorageDescriptor
): CubeTextureSourceSnapshot {
  if (source === null || typeof source !== 'object') {
    throw new InvalidCubeTextureError(label, 'source must be an object')
  }

  const sourceKind: unknown = (source as { readonly kind?: unknown }).kind

  switch (sourceKind) {
    case 'images':
      return createCubeImageSnapshot(label, source as CubeImageSource)

    case 'data':
      return createCubeDataSnapshot(label, source as CubeDataSource, storage)

    default:
      throw new InvalidCubeTextureError(label, `unsupported source kind ${String(sourceKind)}`, {
        sourceKind
      })
  }
}

/**
 * CPU 侧 cubemap 逻辑资源。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][cubemap-cpu-gpu-boundary]
 *
 * CubeTexture 只保存六面 CPU source 与通用 Texture descriptor：
 *
 * - image source：复制并冻结六面容器，但借用图片对象；
 * - data source：复制六个 wrapper 与六个 TypedArray；
 * - 不保存 `WebGLTexture`；
 * - 不执行 WebGL1 NPOT、format extension 或 mipmap capability 验证。
 *
 * 后续 WebGL1CubeTextureManager 以 CubeTexture 对象身份为 key，为每个 WebGL
 * context 创建并管理独立的 GPU handle。
 */
export class CubeTexture extends Texture {
  protected override readonly resourceType = 'CubeTexture'

  /** 构造阶段建立的六面 CPU snapshot；释放后清空以交还大块内存。 */
  private sourceValue: CubeTextureSourceSnapshot | null

  /**
   * @param options - 六面 source 与通用纹理描述。
   * @throws {@link InvalidCubeTextureError} source 或纹理描述违反约束时抛出。
   */
  constructor(options: CubeTextureOptions) {
    const textureLabel = getCubeDiagnosticLabel(options.label)

    super(options, (reason) => new InvalidCubeTextureError(textureLabel, reason))

    this.sourceValue = createCubeSourceSnapshot(this.label, options.source, this.storage)
  }

  /**
   * 返回当前 cubemap 的 CPU source 分类。
   *
   * @throws {@link import('@/rendering/core/errors').ResourceDisposedError}
   * 资源已释放时抛出。
   */
  get sourceKind(): CubeTextureSource['kind'] {
    this.assertUsable()

    return this.sourceValue!.kind
  }

  /**
   * 返回一份不会暴露内部 snapshot 的 cubemap source。
   *
   * @returns image 模式复制 faces 容器并保留借用图片引用；data 模式同时复制六个
   * wrapper 和六个 TypedArray。
   *
   * @throws {@link import('@/rendering/core/errors').ResourceDisposedError}
   * 资源已释放时抛出。
   */
  copySource(): CubeTextureSource {
    this.assertUsable()

    const source = this.sourceValue!

    switch (source.kind) {
      case 'images':
        return {
          kind: 'images',
          faces: copyCubeFaces(source.faces)
        }

      case 'data':
        return {
          kind: 'data',
          faces: copyCubeFaces([
            copyTexturePixelSnapshot2D(source.faces[0]),
            copyTexturePixelSnapshot2D(source.faces[1]),
            copyTexturePixelSnapshot2D(source.faces[2]),
            copyTexturePixelSnapshot2D(source.faces[3]),
            copyTexturePixelSnapshot2D(source.faces[4]),
            copyTexturePixelSnapshot2D(source.faces[5])
          ])
        }

      default:
        return assertNever(source, 'Unsupported CubeTexture source snapshot')
    }
  }

  /**
   * 丢弃 CPU source snapshot。
   *
   * @remarks
   * image 对象是借用引用，因此这里不会调用 `ImageBitmap.close()`；data TypedArray
   * 则在引用清空后等待垃圾回收。GPU handle 由 backend manager 单独释放。
   */
  protected override disposeCPUData(): void {
    this.sourceValue = null
  }
}
