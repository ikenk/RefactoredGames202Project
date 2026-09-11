import { describe, expect, it } from 'vitest'

import { InvalidCubeTextureError, ResourceDisposedError } from '@/rendering/core/errors'
import { CubeTexture, type CubeFaces } from '@/rendering/resources/CubeTexture'
import type { TexturePixelSource2D } from '@/rendering/resources/texturePixelSnapshot'
import type { TextureImageSource } from '@/rendering/resources/Texture2D'

/** 创建允许测试修改数组槽位的六面 tuple。 */
type MutableCubeFaces<T> = [T, T, T, T, T, T]

function createImageSource(width = 4, height = 4): TextureImageSource {
  return {
    width,
    height
  } as ImageBitmap
}

function createImageFaces(): MutableCubeFaces<TextureImageSource> {
  return [
    createImageSource(),
    createImageSource(),
    createImageSource(),
    createImageSource(),
    createImageSource(),
    createImageSource()
  ]
}

function createDataFace(width = 1, height = 1, value = 1): TexturePixelSource2D {
  return {
    data: new Uint8Array(width * height * 4).fill(value),
    width,
    height
  }
}

function createDataFaces(width = 1, height = 1): MutableCubeFaces<TexturePixelSource2D> {
  return [
    createDataFace(width, height, 1),
    createDataFace(width, height, 2),
    createDataFace(width, height, 3),
    createDataFace(width, height, 4),
    createDataFace(width, height, 5),
    createDataFace(width, height, 6)
  ]
}

describe('CubeTexture CPU resource', () => {
  /**
   * CubeTexture 复制 faces 容器，但图片对象本身仍是外部不可复制对象。
   */
  it('复制六面 image source 数组', () => {
    const inputFaces = createImageFaces()
    const originalPositiveX = inputFaces[0]

    const texture = new CubeTexture({
      label: 'skybox',
      source: {
        kind: 'images',
        faces: inputFaces
      },
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'srgb'
    })

    inputFaces[0] = createImageSource(16, 16)

    const copied = texture.copySource()

    expect(copied.kind).toBe('images')

    if (copied.kind === 'images') {
      expect(copied.faces).not.toBe(inputFaces)
      expect(copied.faces[0]).toBe(originalPositiveX)
      expect(copied.faces).toHaveLength(6)
    }
  })

  /**
   * data cubemap 需要同时复制六个 wrapper 和六个 TypedArray。
   */
  it('深复制六面 data source', () => {
    const inputFaces = createDataFaces()

    const texture = new CubeTexture({
      label: 'data-cubemap',
      source: {
        kind: 'data',
        faces: inputFaces
      },
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'linear'
    })

    inputFaces[0].data[0] = 255

    const firstCopy = texture.copySource()

    expect(firstCopy.kind).toBe('data')

    if (firstCopy.kind === 'data') {
      expect(firstCopy.faces[0].data[0]).toBe(1)
      firstCopy.faces[0].data[0] = 200
    }

    const secondCopy = texture.copySource()

    if (secondCopy.kind === 'data') {
      expect(secondCopy.faces[0].data[0]).toBe(1)
    }
  })

  /**
   * TypeScript tuple 是编译期约束，运行时仍可能收到普通数组。
   */
  it('拒绝不是六面的 cubemap source', () => {
    const fiveFaces = createImageFaces().slice(0, 5)

    expect(
      () =>
        new CubeTexture({
          label: 'five-face-cubemap',
          source: {
            kind: 'images',
            faces: fiveFaces as unknown as CubeFaces<TextureImageSource>
          },
          storage: {
            format: 'rgba',
            type: 'uint8'
          },
          colorSpace: 'srgb'
        })
    ).toThrow(InvalidCubeTextureError)
  })

  /**
   * data cubemap 的所有面必须具有相同宽高，才能形成合法的 GPU cubemap storage。
   */
  it('拒绝尺寸不同的 data cubemap faces', () => {
    const faces = createDataFaces()
    faces[5] = createDataFace(2, 1, 6)

    expect(
      () =>
        new CubeTexture({
          label: 'mismatched-faces',
          source: {
            kind: 'data',
            faces
          },
          storage: {
            format: 'rgba',
            type: 'uint8'
          },
          colorSpace: 'linear'
        })
    ).toThrow(InvalidCubeTextureError)
  })

  it('把 data face 的数据类型错误转换成 CubeTexture 领域错误', () => {
    const faces = createDataFaces()

    expect(
      () =>
        new CubeTexture({
          label: 'wrong-data-type',
          source: {
            kind: 'data',
            faces
          },
          storage: {
            format: 'rgba',
            type: 'float32'
          },
          colorSpace: 'linear'
        })
    ).toThrow(InvalidCubeTextureError)
  })

  /**
   * [DESIGN-WEIGHT:3][texture-backend-capability-boundary]
   *
   * 3×3、repeat 和 generated mipmap 对 WebGL1 来说是 NPOT 限制问题，但不是
   * CubeTexture 逻辑数据本身的错误。CPU Resource 必须允许它存在，由
   * WebGL1CubeTextureManager 根据具体 context 能力拒绝或降级。
   */
  it('不在通用 CubeTexture 中执行 WebGL1 NPOT 限制', () => {
    const texture = new CubeTexture({
      label: 'npot-cubemap',
      source: {
        kind: 'data',
        faces: createDataFaces(3, 3)
      },
      sampler: {
        wrapS: 'repeat',
        wrapT: 'repeat',
        minFilter: 'linear-mipmap-linear'
      },
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'linear',
      mipmapPolicy: 'generate'
    })

    expect(texture.copySource().kind).toBe('data')
    expect(texture.sampler.wrapS).toBe('repeat')
    expect(texture.mipmapPolicy).toBe('generate')
  })

  it('拒绝未知 source kind', () => {
    expect(
      () =>
        new CubeTexture({
          label: 'unknown-source',
          source: {
            kind: 'video'
          } as never,
          storage: {
            format: 'rgba',
            type: 'uint8'
          },
          colorSpace: 'srgb'
        })
    ).toThrow(InvalidCubeTextureError)
  })

  it('释放后禁止复制 cubemap source', () => {
    const texture = new CubeTexture({
      label: 'disposed-cubemap',
      source: {
        kind: 'images',
        faces: createImageFaces()
      },
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'srgb'
    })

    texture.dispose()

    expect(texture.disposed).toBe(true)
    expect(() => texture.copySource()).toThrow(ResourceDisposedError)
  })
})
