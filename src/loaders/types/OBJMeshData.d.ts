import { Vec3 } from '@/math/types/math'
// import { Transform } from '@/objects/utils/Transform'
import { SharedTextureData, SharedVertexData } from './SharedMeshData'
import { TextureImageSource } from '@/textures/types/texture'

/** OBJ 加载后的纯数据，不含任何 GPU 资源 */
export interface OBJMeshData extends SharedVertexData, SharedTextureData {
  // Phong 特有
  diffuseColor: Vec3 // Kd / color
  specularColor: Vec3 // Ks / specular
  shininess: number // Ns / shininess
  specularImage: TextureImageSource | null // specularMap (map_Ks)
}
