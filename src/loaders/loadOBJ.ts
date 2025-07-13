import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { LoadingManager } from 'three'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'

import type {
  Mesh as THREEMesh,
  MeshStandardMaterial as THREEMeshStandardMaterial,
  BufferGeometry as THREEBufferGeometry
} from 'three'
import { buildSSRMaterial, SSRMaterial } from '@/materials/SSRMaterial'
import { Mesh } from '@/objects/Mesh'
import { Texture } from '@/textures/Texture'
import { Vec3 } from '@/types/math'
import { MeshRender } from '@/renderers/MeshRender'

export function loadOBJ(
  renderer: WebGLRenderer,
  path: string,
  name: string,
  objMaterial: string,
  transform
) {
  const manager = new LoadingManager()
  manager.onProgress = function (url, loaded, total) {
    console.log(`MTL loaded from ${url.slice(0, 100)}`)
    console.log(`✅ MTL loaded「${loaded}」of「${total}」successfully`)
  }

  function onProgress(xhr: ProgressEvent) {
    if (xhr.lengthComputable) {
      const percentComplete = (xhr.loaded / xhr.total) * 100
      console.log('model ' + Math.round(percentComplete) + '% downloaded')
    }
  }

  function onError(url: string) {
    console.error('❌ Failed to load:', url)
  }

  new MTLLoader(manager).setPath(path).load(name + '.mtl', function (materials) {
    materials.preload()
    new OBJLoader(manager)
      .setMaterials(materials)
      .setPath(path)
      .load(
        name + '.obj',
        function (object) {
          console.log('object: ', object)

          object.traverse(async function (child) {
            console.log('child: ', child)

            if (child.type == 'Mesh') {
              const threeMesh = child as THREEMesh
              let geo = threeMesh.geometry as THREEBufferGeometry
              let material: THREEMeshStandardMaterial
              if (Array.isArray(threeMesh.material))
                material = threeMesh.material[0] as THREEMeshStandardMaterial
              else material = threeMesh.material as THREEMeshStandardMaterial

              var indices = Array.from({ length: geo.attributes.position.count }, (v, k) => k)
              let mesh = new Mesh(
                {
                  name: 'aVertexPosition',
                  array: new Float32Array(geo.attributes.position.array)
                },
                {
                  name: 'aNormalPosition',
                  array: new Float32Array(geo.attributes.normal.array)
                },
                {
                  name: 'aTextureCoord',
                  array: new Float32Array(geo.attributes.uv.array)
                },
                indices,
                transform
              )

              let colorMap = new Texture()
              if (material.map != null) {
                colorMap.CreateImageTexture(renderer.gl, material.map.image)
              } else {
                colorMap.CreateConstantTexture(renderer.gl, material.color.toArray() as Vec3)
              }

              let ssrMaterial: SSRMaterial

              let light = renderer.lights[0].entity
              switch (objMaterial) {
                case 'SSRMaterial':
                  ssrMaterial = await buildSSRMaterial(
                    colorMap,
                    material.specular.toArray(),
                    light,
                    renderer.camera,
                    './src/shaders/ssrShader/ssrVertex.glsl',
                    './src/shaders/ssrShader/ssrFragment.glsl'
                  )

                  let meshRender = new MeshRender(renderer.gl, mesh, ssrMaterial)
                  renderer.addMeshRender(meshRender)
                  break
              }
            }
          })
        },
        onProgress,
        onError
      )
  })
}
