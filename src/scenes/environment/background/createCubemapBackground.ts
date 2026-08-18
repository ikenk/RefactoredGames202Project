import { logger } from '@/logging/Logger'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { CubemapBackgroundConfig } from './types/CubemapBackgroundConfig'
import { CubeMapTexture } from '@/textures/CubeMapTexture'
import { loadHDR } from '@/loaders/loadHDR'
import { loadCubeMapImages } from '@/loaders/loadCubeMapImages'
import { assertNever } from '@/errors/helper/helpers'
import { SkyboxMaterial } from '@/materials/environment/SkyboxMaterial'
import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { CubemapMesh } from '@/objects/CubemapMesh'
import { SkyboxMaterialConfig } from '@/materials/environment/types/SkyboxMaterial'

/**
 * 创建 cubemap 环境背景
 *
 * 语义上是"场景背景"，实现上复用 skybox 渲染技术
 */
export async function createCubemapBackground(
  gl: WebGLRenderingContext,
  config: CubemapBackgroundConfig
): Promise<MeshRenderer> {
  const ctx = '[createCubemapBackground]'
  const rendererName = ''
  // ---- 1. Mesh：单位立方体 ----
  const mesh = new CubemapMesh(gl, `${ctx} SkyboxMesh<${rendererName}>`, config.transform)

  // 由于 SkyboxMesh 的默认大小是 2 * 2 * 2，但 cubemap 的大小不可能总是 2 * 2 * 2，因此需要 config.size 来控制其大小
  const size = config.cubeMapsize
  mesh.setScale(size, size, size)

  // ---- 2. 根据 extension 判断加载方式 ----
  const basePath = config.basePath
  const extension = config.extension
  const defaultFaceKeys = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
  const faceKeys = config.faceKeys ?? defaultFaceKeys

  logger.debug(config)

  const tex = new CubeMapTexture(gl)

  if (extension === '.exr' || extension === '.hdr') {
    // HDR 路径：加载 equirectangular HDR → 转换为 cubemap
    // 使用 equirectToCubemap shader
    const data = await loadHDR({ basePath, extension: extension === '.exr' ? '.exr' : '.hdr' })
    await tex.createCubeMapFromHDR(data, 512, {
      flipY: config.flipY ?? false,
      rotationY: config.rotationY ?? 0
    })
  } else if (extension === '.jpg' || extension === '.png') {
    // LDR 路径：直接加载 6 张图片 → 创建 cubemap texture
    const images = await loadCubeMapImages({ basePath, extension, faceKeys })
    tex.createFromImages(images)
  } else {
    assertNever(extension)
  }

  // ---- 3. Material ----
  const glTexture = tex.glTextureOrThrow
  const materialConfig: SkyboxMaterialConfig = {
    skyboxMap: glTexture,
    isHDR: config.extension === '.hdr' || config.extension === '.exr' ? 1 : 0,
    exposure: config.exposure ?? 1.0
  }
  const material = new SkyboxMaterial(`${ctx} SkyboxMaterial<${rendererName}>`, materialConfig)

  // ---- 4. Shader（两种模式用同一套 skybox shader） ----
  const shader = await Shader.createShader(
    gl,
    ShaderPaths.CUBEMAP_BG_VERTEX,
    ShaderPaths.CUBEMAP_BG_FRAGMENT
  )

  // ---- 4. MeshRenderer ----
  const meshRenderer = new MeshRenderer(gl, mesh, material, shader, 'skyboxMeshRenderer')

  // 天空盒不参与阴影
  meshRenderer.receiveShadow = false
  meshRenderer.castShadow = false

  return meshRenderer
}
