import { loadGLTF } from '@/loaders/loadGLTF'
import { ModelConfig } from './types/ModelConfig'
import { loadOBJ } from '@/loaders/loadOBJ'
import { createMeshRendererFromGLTF } from './fromGLTF/createMeshRendererFromGLTF'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { createMeshRendererFromOBJ } from './fromOBJ/createMeshRendererFromOBJ'

/**
 * 根据 format 自动选择 loader + factory
 */
export async function loadAndCreateRenderers(
  gl: WebGLRenderingContext,
  config: ModelConfig
): Promise<MeshRenderer[]> {
  const { name, format, path, vertShaderPath, fragShaderPath, extraUniforms } = config

  const renderers: MeshRenderer[] = []

  if (format === 'gltf') {
    const meshDataArr = await loadGLTF(path, name)
    for (const data of meshDataArr) {
      const renderer = await createMeshRendererFromGLTF(gl, {
        data,
        rendererName: `${name}/${data.name}`,
        vertShaderPath,
        fragShaderPath,
        extraUniforms
      })
      renderers.push(renderer)
    }
  } else if (format === 'obj') {
    const meshDataArr = await loadOBJ(path, name)
    for (const data of meshDataArr) {
      const renderer = await createMeshRendererFromOBJ(gl, {
        data,
        rendererName: `${name}/${data.name}`,
        vertShaderPath,
        fragShaderPath,
        extraUniforms
      })
      renderers.push(renderer)
    }
  }

  return renderers
}
