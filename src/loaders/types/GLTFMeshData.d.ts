import { Vec3 } from '@/math/types/math'
import { SharedTextureData, SharedVertexData } from './SharedMeshData'
import { TextureImageSource } from '@/textures/types/texture'

/** GLTF 加载后的纯数据，不含任何 GPU 资源 */
export interface GLTFMeshData extends SharedVertexData, SharedTextureData {
  // PBR 特有
  diffuseColor: Vec3 // baseColorFactor
  metalness: number // 0~1
  roughness: number // 0~1
  metalnessImage: TextureImageSource | null // metalnessMap（B通道）
  roughnessImage: TextureImageSource | null // roughnessMap（G通道）
  emissiveColor: Vec3 // emissiveFactor
  emissiveIntensity: number
}
