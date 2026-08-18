import { logger } from '@/logging/Logger'
import { loadOBJ } from '@/loaders/loadOBJ'
import { loadPRTSHTxt } from '@/loaders/loadPRTSHTxt'
import { createSHMesh } from '@/objects/prt/sphericalHarmonics/createSHMesh'
import { PRTSHMaterial } from '@/materials/prt/PRTSHMaterial'
import { Shader } from '@/shaders/Shader'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { Transform } from '@/objects/utils/Transform'
import { ResourceLoadError } from '@/errors/EngineError/ResourceError/ResourceLoadError'
import { OBJMeshData } from '@/loaders/types/OBJMeshData'
import { PRTSHRendererConfig } from './types/PRTSHRendererConfig'

export async function createPRTSHRenderer(
  gl: WebGLRenderingContext,
  config: PRTSHRendererConfig
): Promise<MeshRenderer> {
  const {
    modelPath,
    modelName,
    modelTransform,
    prtDataDir,
    transportType,
    attributeLayout,
    meshTransform,
    uniformLayout,
    vertShaderPath,
    fragShaderPath
  } = config

  const ctx = '[createPRTSHRenderer]'
  const rendererName = 'PRTSHTwoOrderMeshRenderer'

  // 1. 加载 OBJ Data(OBJMeshData[])
  const meshDataArr = await loadOBJ(modelPath, modelName, modelTransform)

  if (meshDataArr.length === 0) {
    throw new ResourceLoadError('model', modelPath + `${modelName}.obj`, {
      reason: 'OBJ file contains no mesh data'
    })
  }

  // 2. 拼接 OBJMeshData[] 中所有 OBJMeshData 的 positions
  const allPositions = concatPositions(meshDataArr)

  // 3. 将格式为 .txt 的源数据转换成 PRTData 类型的数据
  const prtData = await loadPRTSHTxt(prtDataDir, modelName, transportType)

  // console.debug(prtData.lightSH)
  logger.debug(prtData.transportSH.length)
  logger.debug(meshTransform)

  // 4. 创建 Mesh (transport SH 顶点属性)
  const mesh = createSHMesh(
    gl,
    `${ctx} OrderTwoSHMesh<${rendererName}>`,
    allPositions,
    prtData,
    attributeLayout,
    meshTransform ?? new Transform()
  )

  // 5. 创建 Material（light SH uniforms）
  const material = new PRTSHMaterial(
    prtData.lightSH,
    uniformLayout,
    `${ctx} PRTSHMaterial<${rendererName}>`
  )

  // 6. 编译 Shader
  const shader = await Shader.createShader(gl, vertShaderPath, fragShaderPath)

  // 7. 组装 MeshRenderer
  const meshRenderer = new MeshRenderer(gl, mesh, material, shader, `${ctx} ${rendererName}`)

  return meshRenderer
}

/**
 * 将多个 OBJMeshData 的 positions 拼接成一个 Float32Array
 *
 * 为什么需要拼接：
 * - OBJ 文件可能有多个 group，Three.js 会拆成多个 geometry
 * - transport.txt 按原始 OBJ 面顺序存储，不区分 group
 * - 必须把所有 group 的顶点拼回一个连续数组才能和 transport 对齐
 */
function concatPositions(meshDataArr: OBJMeshData[]): Float32Array {
  if (meshDataArr.length === 1) {
    return meshDataArr[0]!.positions // 只有一个 group，直接用
  }

  // 多个 group：计算总长度 → 拼接
  const totalLength = meshDataArr.reduce((sum, d) => sum + d.positions.length, 0)
  const result = new Float32Array(totalLength)
  let offset = 0
  for (const data of meshDataArr) {
    result.set(data.positions, offset)
    offset += data.positions.length
  }

  console.warn(
    `[loadHW2Scene] OBJ has ${meshDataArr.length} groups, ` +
      `concatenated ${totalLength / 3} vertices. ` +
      'Alignment with transport.txt depends on group order matching face order.'
  )

  return result
}
