import type {
  Mesh as THREEMesh,
  MeshStandardMaterial as THREEMeshStandardMaterial,
  BufferGeometry as THREEBufferGeometry
} from 'three'
import { LoadingManager } from 'three'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

import { Mesh } from '@/objects/Mesh'
import { Texture } from '@/textures/Texture'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { MeshRender } from '@/renderers/MeshRender'
import { setTransform } from '@/utils/transformation'
import { buildSSRMaterial, SSRMaterial } from '@/materials/SSRMaterial'
import { buildShadowMaterial, ShadowMaterial } from '@/materials/ShadowMaterial'
import { buildGbufferMaterial, GBufferMaterial } from '@/materials/GBufferMaterial'
import { Vec3 } from '@/types/math'

export function loadGLTF(
  renderer: WebGLRenderer,
  path: string,
  name: string,
  materialName: string
) {
  const manager = new LoadingManager()
  manager.onProgress = function (url, loaded, total) {
    console.log(`GLTF loaded from ${url.slice(0, 100)}`)
    console.log(`✅ GLTF loaded「${loaded}」of「${total}」successfully`)
  }
  manager.onError = onError

  function onProgress(xhr: ProgressEvent) {
    if (xhr.lengthComputable) {
      const percentComplete = (xhr.loaded / xhr.total) * 100
      console.log('model ' + Math.round(percentComplete) + '% downloaded')
    }
  }

  function onError(url: string): void {
    console.error('❌ Failed to load:', url)
  }

  new GLTFLoader(manager).setPath(path).load(
    name + '.gltf',
    function (gltf: GLTF) {
      // console.log(gltf)
      gltf.scene.traverse(async function (child) {
        // console.log(child)
        if (child.type === 'Mesh') {
          // child 是 Mesh 类型
          const threeMesh = child as THREEMesh
          let geo = threeMesh.geometry as THREEBufferGeometry
          let material: THREEMeshStandardMaterial
          if (Array.isArray(threeMesh.material))
            material = threeMesh.material[0] as THREEMeshStandardMaterial
          else material = threeMesh.material as THREEMeshStandardMaterial
          let gltfTransform = setTransform(
            child.position.x,
            child.position.y,
            child.position.z,
            child.scale.x,
            child.scale.y,
            child.scale.z,
            child.rotation.x,
            child.rotation.y,
            child.rotation.z
          )
          // let indices = Array.from({ length: geo.attributes.position.count }, (v, k) => k)
          let mesh = new Mesh(
            { name: 'aVertexPosition', array: new Float32Array(geo.attributes.position.array) },
            { name: 'aNormalPosition', array: new Float32Array(geo.attributes.normal.array) },
            { name: 'aTextureCoord', array: new Float32Array(geo.attributes.uv.array) },
            Array.from(geo.index.array),
            gltfTransform
          )

          // console.log(material.map.image)
          // console.log(material.color.toArray())

          let diffuseMap = new Texture()
          if (material.map != null) {
            diffuseMap.CreateImageTexture(renderer.gl, material.map.image)
          } else {
            diffuseMap.CreateConstantTexture(renderer.gl, material.color.toArray() as Vec3, true)
          }

          let specularMap = new Texture()
          specularMap.CreateConstantTexture(renderer.gl, [0, 0, 0])
          let normalMap = new Texture()
          if (material.normalMap != null) {
            normalMap.CreateImageTexture(renderer.gl, material.normalMap.image)
          } else {
            normalMap.CreateConstantTexture(renderer.gl, [0.5, 0.5, 1], false)
          }

          let light = renderer.lights[0].entity
          let ssrMaterial: SSRMaterial
          let shadowMaterial: ShadowMaterial
          let bufferMaterial: GBufferMaterial

          // switch (materialName) {
          //   case 'SSRMaterial':
          //     material = buildSSRMaterial(
          //       diffuseMap,
          //       specularMap,
          //       light,
          //       renderer.camera,
          //       `./src/shaders/ssrShader/ssrVertex.glsl`,
          //       './src/shaders/ssrShader/ssrFragment.glsl'
          //     )
          //     shadowMaterial = buildShadowMaterial(
          //       light,
          //       './src/shaders/shadowShader/shadowVertex.glsl',
          //       './src/shaders/shadowShader/shadowFragment.glsl'
          //     )
          //     bufferMaterial = buildGbufferMaterial(
          //       diffuseMap,
          //       normalMap,
          //       light,
          //       renderer.camera,
          //       './src/shaders/gbufferShader/gbufferVertex.glsl',
          //       './src/shaders/gbufferShader/gbufferFragment.glsl'
          //     )
          //     break
          // }

          // material.then((material) => {
          //   let meshRender = new MeshRender(renderer.gl, mesh, material)
          //   renderer.addMeshRender(meshRender)
          // })
          // shadowMaterial.then((material) => {
          //   let shadowMeshRender = new MeshRender(renderer.gl, mesh, material)
          //   renderer.addShadowMeshRender(shadowMeshRender)
          // })
          // bufferMaterial.then((material) => {
          //   let bufferMeshRender = new MeshRender(renderer.gl, mesh, material)
          //   renderer.addBufferMeshRender(bufferMeshRender)
          // })

          switch (materialName) {
            case 'SSRMaterial':
              ssrMaterial = await buildSSRMaterial(
                diffuseMap,
                specularMap,
                light,
                renderer.camera,
                `./src/shaders/ssrShader/ssrVertex.glsl`,
                './src/shaders/ssrShader/ssrFragment.glsl'
              )
              shadowMaterial = await buildShadowMaterial(
                light,
                './src/shaders/shadowShader/shadowVertex.glsl',
                './src/shaders/shadowShader/shadowFragment.glsl'
              )
              bufferMaterial = await buildGbufferMaterial(
                diffuseMap,
                normalMap,
                light,
                renderer.camera,
                './src/shaders/gbufferShader/gbufferVertex.glsl',
                './src/shaders/gbufferShader/gbufferFragment.glsl'
              )

              let meshRender = new MeshRender(renderer.gl, mesh, ssrMaterial)
              renderer.addMeshRender(meshRender)
              let shadowMeshRender = new MeshRender(renderer.gl, mesh, shadowMaterial)
              renderer.addShadowMeshRender(shadowMeshRender)
              let bufferMeshRender = new MeshRender(renderer.gl, mesh, bufferMaterial)
              renderer.addBufferMeshRender(bufferMeshRender)
              break
          }
        }
      })
    },
    onProgress,
    onError
  )
}
