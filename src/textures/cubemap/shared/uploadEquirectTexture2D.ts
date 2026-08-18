import { getCapabilities } from '@/_config/glCapabilities'
import { InvalidTextureFormatError } from '@/errors/EngineError/TextureError/InvalidTextureFormatError'
import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { WebGLExtensionError } from '@/errors/EngineError/WebGLError/WebGLExtensionError'
import { DataTexture } from 'three'

interface FloatDataTextureSource {
  data: Float32Array
  width: number
  height: number
}

function isFloatDataTextureSource(value: unknown): value is FloatDataTextureSource {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'data' in value &&
    value.data instanceof Float32Array &&
    'width' in value &&
    typeof value.width === 'number' &&
    Number.isInteger(value.width) &&
    value.width > 0 &&
    'height' in value &&
    typeof value.height === 'number' &&
    Number.isInteger(value.height) &&
    value.height > 0
  )
}

export function uploadEquirectTexture2D(
  gl: WebGLRenderingContext,
  dataTexture: DataTexture
): WebGLTexture {
  // 1. 验证输入 & 扩展
  const sourceData: unknown = dataTexture.source.data

  if (!isFloatDataTextureSource(sourceData)) {
    throw new InvalidTextureFormatError(
      'HDR 环境贴图必须包含 Float32Array data 和有效的 width/height',
      {
        actualType: Object.prototype.toString.call(sourceData)
      }
    )
  }

  const { data, width, height } = sourceData
  if (!getCapabilities().floatTexture) {
    throw new WebGLExtensionError('OES_texture_float')
  }

  const channels = data.length / (width * height)
  const glFormat = channels === 3 ? gl.RGB : gl.RGBA

  // 2. 上传 HDR 2D 纹理
  const hdrTexture = gl.createTexture()
  if (!hdrTexture) throw new TextureCreationError('TEXTURE_2D', { width, height })
  gl.bindTexture(gl.TEXTURE_2D, hdrTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, width, height, 0, glFormat, gl.FLOAT, data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.bindTexture(gl.TEXTURE_2D, null)

  return hdrTexture
}
