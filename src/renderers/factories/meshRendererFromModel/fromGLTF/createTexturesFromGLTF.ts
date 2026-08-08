import { GLTFMeshData } from '@/loaders/types/GLTFMeshData'
import { Texture } from '@/textures/Texture'
import { GLTF_TEXTURE_UNIFORM_MAP } from '../constants/gltfTextureUniformMap'
import { TEXTURE_FALLBACK_MAP } from '../constants/textureFallbackMap'
import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { Vec3 } from '@/math/types/math'

/**
 * 从 GLTFMeshData 中提取所有贴图，创建对应的 Texture。
 *
 * 遍历 GLTF_TEXTURE_UNIFORM_MAP，对每个贴图字段：
 * - 有图片 → 从图片创建纹理
 * - 无图片 → 用 fallback 颜色（优先取 data 中对应颜色字段，否则用静态默认值）
 *
 * @returns uniform 名 → Texture 的映射
 */
export function createTexturesFromGLTF(
  gl: WebGLRenderingContext,
  data: GLTFMeshData
): Map<string, Texture> {
  const result = new Map<string, Texture>()

  for (const [field, uniformName] of Object.entries(GLTF_TEXTURE_UNIFORM_MAP)) {
    const image = data[field as keyof GLTFMeshData]

    const tex = new Texture(gl)

    if (isTextureImageSource(image)) {
      tex.createFromImage(image)
    } else {
      //       console.debug(`[GLTF Texture] ${field} → fallback 纯色`)
      if (TEXTURE_FALLBACK_MAP[field]) {
        const { colorField, fallback } = TEXTURE_FALLBACK_MAP[field]
        const color: Vec3 = colorField
          ? ((data[colorField as keyof GLTFMeshData] as Vec3) ?? fallback)
          : fallback
        tex.createFromColor(color)
      } else {
        throw new TextureCreationError('TEXTURE_2D', {
          reason: `"${field}" exsits in GLTF_TEXTURE_UNIFORM_MAP but not in TEXTURE_FALLBACK_MAP`
        })
      }
    }

    result.set(uniformName, tex)
  }

  return result
}

function isTextureImageSource(value: unknown): value is TexImageSource {
  return value instanceof HTMLImageElement || value instanceof ImageBitmap
}
