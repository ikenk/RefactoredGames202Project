import { Mesh } from '@/objects/Mesh'
import { Transform } from '@/objects/utils/Transform'
import type { AttributeData } from '@/objects/types/Mesh'
import type { PRTData } from '@/loaders/loadPRTSHTxt'
import { MeshValidationError } from '@/errors/EngineError/MeshError/MeshValidationError'
import type { SHAttributeLayout } from './types/SHAttributeLayout'

/**
 * 用 OBJ 的面展开位置 + PRT 的 transport SH 创建 Mesh
 *
 * @param gl       WebGL 上下文
 * @param positions OBJ 面展开后的顶点位置 Float32Array（来自 loadOBJ 的 data.positions）
 * @param prtData  loadPRT 的返回值
 * @param transform 模型变换
 * @returns 无索引的 Mesh（用 drawArrays 渲染）
 */
export function createSHMesh(
  gl: WebGLRenderingContext,
  meshName: string,
  positions: Float32Array,
  prtData: PRTData,
  layout: SHAttributeLayout,
  transform: Transform
): Mesh {
  const { transportSH } = prtData
  const vertexCount = positions.length / 3

  if (vertexCount !== transportSH.length) {
    throw new MeshValidationError(
      'vertex_count_mismatch',
      `OBJ has ${vertexCount} face-vertices, ` + `transport.txt has ${transportSH.length} entries`,
      meshName
    )
  }

  const expectedCoeffCount = layout.reduce((sum, item) => sum + item.size, 0)
  if (transportSH.length > 0 && transportSH[0] && transportSH[0].length !== expectedCoeffCount) {
    throw new MeshValidationError(
      'attribute_length_mismatch',
      `Layout expects ${expectedCoeffCount} coefficients per vertex, ` +
        `but transport data has ${transportSH[0].length}`,
      meshName
    )
  }

  // 把 transport SH 拆成 3/4 个 Float32Array（每个 3/4 floats/vertex）
  // transport.txt 每行 9/16 个系数（order 2/3）
  // 拆成 [0,1,2] [3,4,5] [6,7,8] / [0,1,2,3] [4,5,6,7] [8,9,10,11] [12,13,14,15]
  const shArr = layout.map((item) => new Float32Array(vertexCount * item.size))
  // const sh0 = new Float32Array(vertexCount * 3)
  // const sh1 = new Float32Array(vertexCount * 3)
  // const sh2 = new Float32Array(vertexCount * 3)

  for (let i = 0; i < vertexCount; i++) {
    const coeffs = transportSH[i]!
    // const base = i * 3
    let offset = 0

    for (let j = 0; j < layout.length; j++) {
      const base = i * layout[j]!.size

      for (let k = 0; k < shArr.length; k++) {
        // if (i === 0) console.log(offset + k)
        shArr[j]![base + k] = coeffs[offset + k] ?? 0
      }

      offset += layout[j]!.size
    }
  }

  // console.debug(shArr)

  // 组装 attributes
  const attributes: AttributeData[] = [
    { name: 'aVertexPosition', array: positions, size: 3, type: gl.FLOAT },
    ...layout.map((item, index) => {
      return {
        name: item.name,
        array: shArr[index]!,
        size: item.size,
        type: gl.FLOAT
      }
    })
  ]

  // null indices → drawArrays
  return new Mesh(attributes, null, transform, meshName, gl)
}
