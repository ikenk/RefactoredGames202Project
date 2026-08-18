import { Vec3 } from '@/math/types/math'
import { Transform } from '@/objects/utils/Transform'
import { Mesh as THREEMesh, MeshPhongMaterial } from 'three'
import { LoadingManager } from 'three'
import { MTLLoader, OBJLoader } from 'three/examples/jsm/Addons.js'
import { OBJMeshData } from './types/OBJMeshData'
import { getTextureImageSource } from './utils/getTextureImageSource'

/** 只负责加载和解析 OBJ + MTL，返回纯数据 */
export async function loadOBJ(
  path: string,
  name: string,
  transform: Transform = Transform.identity()
): Promise<OBJMeshData[]> {
  return new Promise<OBJMeshData[]>((resolve, reject) => {
    const manager = new LoadingManager()
    manager.onProgress = (url, loaded, total) => {
      console.log(`[OBJLoader] Loaded ${loaded} of ${total}: ${url.slice(0, 100)}`)
    }

    // 第一步：加载 MTL 材质
    new MTLLoader(manager).setPath(path).load(
      name + '.mtl',
      (materials) => {
        materials.preload()

        // 第二步：用已加载的材质加载 OBJ 几何
        new OBJLoader(manager)
          .setMaterials(materials)
          .setPath(path)
          .load(
            name + '.obj',
            (object) => {
              const dataArr: OBJMeshData[] = []

              object.traverse((child) => {
                if (child.type !== 'Mesh') return

                const threeMesh = child as THREEMesh
                const geo = threeMesh.geometry

                // ⚠️ OBJ + MTL 返回的是 MeshPhongMaterial，不是 MeshStandardMaterial
                const mat = Array.isArray(threeMesh.material)
                  ? (threeMesh.material[0] as MeshPhongMaterial)
                  : (threeMesh.material as MeshPhongMaterial)

                // console.debug(mat)

                // position 是必须的
                const positionAttr = geo.getAttribute('position')
                if (!positionAttr) {
                  console.warn(
                    `[OBJLoader] Mesh "${child.name}" has no position attribute, skipping`
                  )
                  return
                }

                // normal 和 uv 是可选的
                const normalAttr = geo.getAttribute('normal')
                const uvAttr = geo.getAttribute('uv')
                const tangentAttr = geo.getAttribute('tangent')
                const colorAttr = geo.getAttribute('color')

                // OBJ 文件可能没有索引（旧代码就是自己生成顺序索引的）
                const indices = geo.index
                  ? Array.from(geo.index.array)
                  : Array.from({ length: positionAttr.count }, (_, i) => i)

                if (!geo.index) {
                  geo.setIndex(indices)
                }

                // console.debug(indices)

                if (!tangentAttr && normalAttr && uvAttr) {
                  // 加载后，如果有 normal + uv 但没有 tangent，自动计算
                  geo.computeTangents()
                }
                const computedTangentAttr = geo.getAttribute('tangent')

                dataArr.push({
                  name: child.name || 'unnamed',
                  positions: new Float32Array(positionAttr.array),
                  normals: normalAttr ? new Float32Array(normalAttr.array) : null,
                  uvs: uvAttr ? new Float32Array(uvAttr.array) : null,
                  indices,
                  transform,
                  tangents: computedTangentAttr
                    ? new Float32Array(computedTangentAttr.array)
                    : null,
                  colors: colorAttr ? new Float32Array(colorAttr.array) : null,
                  diffuseImage: getTextureImageSource(mat.map),
                  diffuseColor: mat.color.toArray() as Vec3,
                  specularImage: getTextureImageSource(mat.specularMap),
                  specularColor: mat.specular.toArray() as Vec3,
                  shininess: mat.shininess ?? 30,
                  normalImage: getTextureImageSource(mat.normalMap),
                  aoImage: getTextureImageSource(mat.aoMap),
                  emissiveImage: getTextureImageSource(mat.emissiveMap),
                  displacementImage: getTextureImageSource(mat.displacementMap),
                  alphaImage: getTextureImageSource(mat.alphaMap)
                })
              })

              resolve(dataArr)
            },
            onProgress,
            (error) => reject(error)
          )
      },
      onProgress,
      (error) => reject(error)
    )
  })
}

function onProgress(xhr: ProgressEvent) {
  if (xhr.lengthComputable) {
    const percentComplete = (xhr.loaded / xhr.total) * 100
    console.log('model ' + Math.round(percentComplete) + '% downloaded')
  }
}
