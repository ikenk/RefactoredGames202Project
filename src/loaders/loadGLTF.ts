import { Vec3 } from '@/math/types/math'
import { Transform } from '@/objects/utils/Transform'
import { Mesh as THREEMesh, MeshStandardMaterial } from 'three'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { GLTFMeshData } from './types/GLTFMeshData'
import { getTextureImageSource } from './utils/getTextureImageSource'

/** 只负责加载和解析，返回纯数据 */
export async function loadGLTF(
  path: string,
  name: string,
  transformOverride?: Transform
): Promise<GLTFMeshData[]> {
  return new Promise((resolve, reject) => {
    const dataArr: GLTFMeshData[] = []

    new GLTFLoader().setPath(path).load(
      name + '.gltf',
      (gltf) => {
        gltf.scene.traverse((child) => {
          if (child.type !== 'Mesh') return

          const threeMesh = child as THREEMesh
          const geo = threeMesh.geometry

          const mat = Array.isArray(threeMesh.material)
            ? (threeMesh.material[0] as MeshStandardMaterial)
            : (threeMesh.material as MeshStandardMaterial)

          // ✅ 用 getAttribute() 取出后检查
          const positionAttr = geo.getAttribute('position')
          if (!positionAttr) {
            console.warn(`[GLTFLoader] Mesh "${child.name}" has no position attribute, skipping`)
            return // 跳过这个 mesh
          }

          const normalAttr = geo.getAttribute('normal')
          const uvAttr = geo.getAttribute('uv')
          const tangentAttr = geo.getAttribute('tangent')
          const colorAttr = geo.getAttribute('color')

          // 索引：非索引几何体需要自己生成
          const indices = geo.index
            ? Array.from(geo.index.array)
            : Array.from({ length: positionAttr.count }, (_, i) => i)

          if (!geo.index) {
            geo.setIndex(indices)
          }

          // 加载后，如果有 normal + uv 但没有 tangent，自动计算
          if (!tangentAttr && normalAttr && uvAttr) {
            geo.computeTangents()
          }
          const computedTangentAttr = geo.getAttribute('tangent')

          dataArr.push({
            name: child.name || 'unnamed',
            positions: new Float32Array(positionAttr.array),
            normals: normalAttr ? new Float32Array(normalAttr.array) : null,
            uvs: uvAttr ? new Float32Array(uvAttr.array) : null,
            indices: indices,
            tangents: computedTangentAttr ? new Float32Array(computedTangentAttr.array) : null,
            colors: colorAttr ? new Float32Array(colorAttr.array) : null,
            transform:
              transformOverride ??
              new Transform(
                [child.position.x, child.position.y, child.position.z],
                [child.rotation.x, child.rotation.y, child.rotation.z],
                [child.scale.x, child.scale.y, child.scale.z]
              ),
            // PBR 材质数据 -- PBR 贴图
            diffuseImage: getTextureImageSource(mat.map),
            normalImage: getTextureImageSource(mat.normalMap),
            metalnessImage: getTextureImageSource(mat.metalnessMap),
            aoImage: getTextureImageSource(mat.aoMap),
            emissiveImage: getTextureImageSource(mat.emissiveMap),
            roughnessImage: getTextureImageSource(mat.roughnessMap),
            displacementImage: getTextureImageSource(mat.displacementMap),
            alphaImage: getTextureImageSource(mat.alphaMap),
            // PBR 材质数据 -- PBR 标量参数
            diffuseColor: mat.color.toArray() as Vec3,
            metalness: mat.metalness ?? 0,
            roughness: mat.roughness ?? 0.5,
            emissiveColor: mat.emissive.toArray() as Vec3,
            emissiveIntensity: mat.emissiveIntensity ?? 0
          })
        })
        resolve(dataArr)
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percentComplete = (xhr.loaded / xhr.total) * 100
          console.log('model ' + Math.round(percentComplete) + '% downloaded')
        }
      },
      (error) => reject(error)
    )
  })
}
