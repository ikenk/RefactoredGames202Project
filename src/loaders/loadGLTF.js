import { LoadingManager } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

import { Mesh } from '@/objects/Mesh'
import { Texture } from '@/textures/Texture'
import { MeshRender } from '@/renderers/MeshRender'
import { setTransform } from '@/utils/transformation'
import { buildSSRMaterial } from '@/materials/SSRMaterial'
import { buildShadowMaterial } from '@/materials/ShadowMaterial'
import { buildGbufferMaterial } from '@/materials/GBufferMaterial'

export function loadGLTF(renderer, path, name, materialName) {
  const manager = new LoadingManager()
  manager.onProgress = function (item, loaded, total) {
    // console.log(item, loaded, total)
    console.log(`✅ GLTF loaded「${loaded}」of「${total}」successfully`)
  }
  manager.onError = onError

  function onProgress(xhr) {
    if (xhr.lengthComputable) {
      const percentComplete = (xhr.loaded / xhr.total) * 100
      console.log('model ' + Math.round(percentComplete, 2) + '% downloaded')
    }
  }
  function onError() {
    console.error('❌ Failed to load:', url)
  }

  new GLTFLoader(manager).setPath(path).load(name + '.gltf', function (gltf) {
    // console.log(gltf)
    gltf.scene.traverse(function (child) {
      if (child.isMesh) {
        let geo = child.geometry
        let mat
        if (Array.isArray(child.material)) mat = child.material[0]
        else mat = child.material
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
          { name: 'aVertexPosition', array: geo.attributes.position.array },
          { name: 'aNormalPosition', array: geo.attributes.normal.array },
          { name: 'aTextureCoord', array: geo.attributes.uv.array },
          geo.index.array,
          gltfTransform
        )

        let diffuseMap = new Texture()
        if (mat.map != null) {
          diffuseMap.CreateImageTexture(renderer.gl, mat.map.image)
        } else {
          diffuseMap.CreateConstantTexture(renderer.gl, mat.color.toArray(), true)
        }

        let specularMap = new Texture()
        specularMap.CreateConstantTexture(renderer.gl, [0, 0, 0])
        let normalMap = new Texture()
        if (mat.normalMap != null) {
          normalMap.CreateImageTexture(renderer.gl, mat.normalMap.image)
        } else {
          normalMap.CreateConstantTexture(renderer.gl, [0.5, 0.5, 1], false)
        }

        let light = renderer.lights[0].entity
        let material, shadowMaterial, bufferMaterial
        switch (materialName) {
          case 'SSRMaterial':
            material = buildSSRMaterial(
              diffuseMap,
              specularMap,
              light,
              renderer.camera,
              `./src/shaders/ssrShader/ssrVertex.glsl`,
              './src/shaders/ssrShader/ssrFragment.glsl'
            )
            shadowMaterial = buildShadowMaterial(
              light,
              './src/shaders/shadowShader/shadowVertex.glsl',
              './src/shaders/shadowShader/shadowFragment.glsl'
            )
            bufferMaterial = buildGbufferMaterial(
              diffuseMap,
              normalMap,
              light,
              renderer.camera,
              './src/shaders/gbufferShader/gbufferVertex.glsl',
              './src/shaders/gbufferShader/gbufferFragment.glsl'
            )
            break
        }

        material.then((material) => {
          let meshRender = new MeshRender(renderer.gl, mesh, material)
          renderer.addMeshRender(meshRender)
        })
        shadowMaterial.then((material) => {
          let shadowMeshRender = new MeshRender(renderer.gl, mesh, material)
          renderer.addShadowMeshRender(shadowMeshRender)
        })
        bufferMaterial.then((material) => {
          let bufferMeshRender = new MeshRender(renderer.gl, mesh, material)
          renderer.addBufferMeshRender(bufferMeshRender)
        })
      }
    })
  })
}
