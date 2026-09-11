import { describe, expect, it } from 'vitest'

import { InvalidTextureSourceError, ResourceDisposedError } from '@/rendering/core/errors'
import {
  DataTexture2D,
  ImageTexture2D,
  type TextureImageSource
} from '@/rendering/resources/Texture2D'
import type { TextureWrapMode } from '@/rendering/resources/Texture'

/**
 * 创建仅供 CPU 逻辑资源测试使用的图片对象。
 *
 * @remarks
 * Texture CPU 层只保存图片引用。浏览器对象种类、加载状态及 WebGL 可上传性由后续
 * backend manager 验证，因此单元测试不需要真正启动 DOM 图片解码。
 */
function createImageSource(width = 4, height = 4): TextureImageSource {
  return {
    width,
    height
  } as ImageBitmap
}

describe('Texture2D CPU resources', () => {
  /**
   * DataTexture2D 必须拥有自己的 TypedArray snapshot。
   *
   * 如果生产代码直接保存调用者的数组引用，把 input[0] 改为 999 后该测试会失败。
   */
  it('复制 HDR Float32 数据及其二维尺寸', () => {
    const input = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])

    const texture = new DataTexture2D({
      label: 'studio-hdr',
      source: {
        data: input,
        width: 2,
        height: 1
      },
      storage: {
        format: 'rgb',
        type: 'float32'
      },
      colorSpace: 'linear'
    })

    input[0] = 999

    expect(texture.width).toBe(2)
    expect(texture.height).toBe(1)
    expect(texture.copySource()).toEqual({
      data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
      width: 2,
      height: 1
    })
  })

  /**
   * copySource() 自身也必须返回副本，避免调用者反向修改私有 snapshot。
   */
  it('每次读取 DataTexture2D source 都返回独立 TypedArray', () => {
    const texture = new DataTexture2D({
      label: 'lookup-table',
      source: {
        data: new Uint8Array([10, 20, 30, 40]),
        width: 1,
        height: 1
      },
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'data'
    })

    const firstCopy = texture.copySource()
    firstCopy.data[0] = 255

    expect(texture.copySource().data[0]).toBe(10)
  })

  /**
   * 通用 Texture descriptor 必须建立浅层冻结快照。
   *
   * sampler 只包含字符串原始值，所以复制并冻结一层已经足够。
   */
  it('复制 sampler 配置并填充安全默认值', () => {
    const sampler: {
      wrapS: TextureWrapMode
    } = {
      wrapS: 'repeat'
    }

    const texture = new DataTexture2D({
      label: 'sampler-test',
      source: {
        data: new Uint8Array([1, 2, 3, 4]),
        width: 1,
        height: 1
      },
      sampler,
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'srgb'
    })

    sampler.wrapS = 'clamp-to-edge'

    expect(texture.sampler).toEqual({
      wrapS: 'repeat',
      wrapT: 'clamp-to-edge',
      minFilter: 'linear',
      magFilter: 'linear'
    })
    expect(Object.isFrozen(texture.sampler)).toBe(true)
    expect(Object.isFrozen(texture.storage)).toBe(true)
    expect(texture.mipmapPolicy).toBe('none')
  })

  /**
   * 使用 mipmap minification filter 时，资源必须明确声明 mipmap 生成策略。
   */
  it('拒绝没有 mipmap policy 的 mipmap min filter', () => {
    expect(
      () =>
        new DataTexture2D({
          label: 'missing-mipmaps',
          source: {
            data: new Uint8Array([1, 2, 3, 4]),
            width: 1,
            height: 1
          },
          sampler: {
            minFilter: 'linear-mipmap-linear'
          },
          storage: {
            format: 'rgba',
            type: 'uint8'
          },
          colorSpace: 'srgb'
        })
    ).toThrow(InvalidTextureSourceError)
  })

  it('允许 generate policy 与 mipmap min filter 配合', () => {
    const texture = new DataTexture2D({
      label: 'generated-mipmaps',
      source: {
        data: new Uint8Array([1, 2, 3, 4]),
        width: 1,
        height: 1
      },
      sampler: {
        minFilter: 'linear-mipmap-linear'
      },
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'srgb',
      mipmapPolicy: 'generate'
    })

    expect(texture.mipmapPolicy).toBe('generate')
    expect(texture.sampler.minFilter).toBe('linear-mipmap-linear')
  })

  it('拒绝非正整数宽高', () => {
    expect(
      () =>
        new DataTexture2D({
          label: 'invalid-dimensions',
          source: {
            data: new Uint8Array(4),
            width: 1.5,
            height: 1
          },
          storage: {
            format: 'rgba',
            type: 'uint8'
          },
          colorSpace: 'data'
        })
    ).toThrow(InvalidTextureSourceError)
  })

  /**
   * rgba × 2 × 1 需要八个标量。少一个也不能被静默上传。
   */
  it('拒绝与 format 和尺寸不匹配的数据长度', () => {
    expect(
      () =>
        new DataTexture2D({
          label: 'invalid-length',
          source: {
            data: new Uint8Array(7),
            width: 2,
            height: 1
          },
          storage: {
            format: 'rgba',
            type: 'uint8'
          },
          colorSpace: 'data'
        })
    ).toThrow(InvalidTextureSourceError)
  })

  /**
   * storage.type 是逻辑像素类型，不允许与实际 TypedArray 悄悄发生转换。
   */
  it('拒绝与 storage.type 不匹配的 TypedArray', () => {
    expect(
      () =>
        new DataTexture2D({
          label: 'invalid-data-type',
          source: {
            data: new Uint8Array(4),
            width: 1,
            height: 1
          },
          storage: {
            format: 'rgba',
            type: 'float32'
          },
          colorSpace: 'linear'
        })
    ).toThrow(InvalidTextureSourceError)
  })

  /**
   * ImageBitmap/HTMLImageElement 是浏览器管理的外部对象，不能像 TypedArray
   * 那样深拷贝。CPU Resource 保存稳定引用，但不取得 close()/DOM 生命周期所有权。
   */
  it('ImageTexture2D 保留图片引用和纹理描述', () => {
    const source = createImageSource(512, 256)

    const texture = new ImageTexture2D({
      label: 'albedo',
      source,
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'srgb'
    })

    expect(texture.source).toBe(source)
    expect(texture.label).toBe('albedo')
    expect(texture.colorSpace).toBe('srgb')
  })

  it('拒绝运行时为空的 ImageTexture2D source', () => {
    expect(
      () =>
        new ImageTexture2D({
          label: 'missing-image',
          source: null as unknown as TextureImageSource,
          storage: {
            format: 'rgba',
            type: 'uint8'
          },
          colorSpace: 'srgb'
        })
    ).toThrow(InvalidTextureSourceError)
  })

  /**
   * Resource.dispose() 后断开大块 CPU 数据或外部图片引用。
   */
  it('释放后禁止读取 Texture2D source', () => {
    const dataTexture = new DataTexture2D({
      label: 'disposed-data',
      source: {
        data: new Uint8Array([1, 2, 3, 4]),
        width: 1,
        height: 1
      },
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'data'
    })

    const imageTexture = new ImageTexture2D({
      label: 'disposed-image',
      source: createImageSource(),
      storage: {
        format: 'rgba',
        type: 'uint8'
      },
      colorSpace: 'srgb'
    })

    dataTexture.dispose()
    imageTexture.dispose()

    expect(() => dataTexture.copySource()).toThrow(ResourceDisposedError)
    expect(() => imageTexture.source).toThrow(ResourceDisposedError)
  })
})
