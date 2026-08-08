import { OBJMeshData } from '@/loaders/types/OBJMeshData'
import { Texture } from '@/textures/Texture'
import { Vec3 } from '@/math/types/math'
import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { OBJ_TEXTURE_UNIFORM_MAP } from '../constants/objTextureUniformMap'
import { TEXTURE_FALLBACK_MAP } from '../constants/textureFallbackMap'

/**
 * 从 OBJMeshData 中提取所有贴图，创建对应的 Texture。
 *
 * 遍历 OBJ_TEXTURE_UNIFORM_MAP，对每个贴图字段：
 * - 有图片 → 从图片创建纹理
 * - 无图片 → 用 fallback 颜色
 *
 * @returns uniform 名 → Texture 的映射
 */
export function createTexturesFromOBJ(
  gl: WebGLRenderingContext,
  data: OBJMeshData
): Map<string, Texture> {
  const result: Map<string, Texture> = new Map()

  for (const [field, uniformName] of Object.entries(OBJ_TEXTURE_UNIFORM_MAP)) {
    const image = data[field as keyof OBJMeshData]

    const tex = new Texture(gl)

    if (isTextureImageSource(image)) {
      tex.createFromImage(image)
    } else {
      //       console.debug(`[OBJ Texture] ${field} → fallback 纯色`)
      if (TEXTURE_FALLBACK_MAP[field]) {
        const { colorField, fallback } = TEXTURE_FALLBACK_MAP[field]
        const color: Vec3 = colorField
          ? ((data[colorField as keyof OBJMeshData] as Vec3) ?? fallback)
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
