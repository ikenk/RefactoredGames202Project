import { Mesh } from '@/objects/Mesh'
import type { TransformationParams } from '@/types/transformation'

interface MeshData {
  positions: { name: string; array: Float32Array }
  normals: { name: string; array: Float32Array }
  texCoords: { name: string; array: Float32Array }
  indices: number[]
}

export class WaterSurface extends Mesh {
  // private size: number
  // private resolution: number

  constructor(
    // meshData: MeshData,
    transform: TransformationParams,
    size: number,
    resolution: number
  ) {
    const meshData = WaterSurface.generateWaterMeshParams(size, resolution)
    super(meshData.positions, meshData.normals, meshData.texCoords, meshData.indices, transform)
    // this.size = size
    // this.resolution = resolution
  }

  /**
   * 生成 vertex 的 positions 和 indies
   * @param {number} size 水面大小
   * @param {number} resolution 水面分辨率，即每行、每列有多少个 vertex
   * 由于 WebGL1.0 的限制，indices 的大小最多为 unsigned int 16 bit，也就是 65536
   * 因此 resolution 的值不能太高，否则图中的 vertex 的个数超过了 65536 的话，就会显示错误
   * */
  private static generateWaterMeshParams(size: number, resolution: number): MeshData {
    const positions: number[] = []
    const normals: number[] = []
    const texCoords: number[] = []

    const indices: number[] = []

    // 生成顶点
    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        // (i / resolution) ∈ [0,1];
        // (i / resolution - 0.5) ∈ [-0.5,0.5];
        const x = (i / resolution - 0.5) * size
        const z = (j / resolution - 0.5) * size
        const u = i / resolution
        const v = j / resolution

        positions.push(x, 0, z)
        normals.push(0, 1, 0) // 初始法线向上
        texCoords.push(u, v)
      }
    }

    // 生成索引
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const topLeft = i * (resolution + 1) + j
        const topRight = topLeft + 1
        const bottomLeft = (i + 1) * (resolution + 1) + j
        const bottomRight = bottomLeft + 1

        /**
         * 两个三角形组成一个四边形
         * 在WebGL中：正面（front-facing）三角形通常定义为逆时针，背面剔除（back-face culling）会把顺时针的三角形当作背面剔除掉，结果就是些三角形不会被渲染，或者法线方向错误
         */
        // 保证三角形的正确绕序（winding order）
        indices.push(topLeft, bottomLeft, topRight)
        indices.push(topRight, bottomLeft, bottomRight)
      }
    }

    return {
      positions: { name: 'aVertexPosition', array: new Float32Array(positions) },
      normals: { name: 'aNormalPosition', array: new Float32Array(normals) },
      texCoords: { name: 'aTextureCoord', array: new Float32Array(texCoords) },
      indices
    }
  }
}
