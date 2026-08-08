import { MeshRendererFromGLTFConfig } from '../types/MeshRendererFromGLTFConfig'
import { Uniforms, UniformType } from '@/materials/types/Material'
import { Material } from '@/materials/Material'
import { Shader } from '@/shaders/Shader'
import { MeshRenderer } from '../../../MeshRenderer'
import { Mesh } from '@/objects/Mesh'
import { GLTFMeshData } from '@/loaders/types/GLTFMeshData'
import { Texture } from '@/textures/Texture'
import { AttributeData } from '@/objects/types/Mesh'
import { createTexturesFromGLTF } from './createTexturesFromGLTF'

// ============================================================
//  工厂函数
// ============================================================

/**
 * 通用工厂：GLTFMeshData → MeshRenderer
 *
 * 职责分工：
 * - loaders/   → loadGLTF() 返回纯数据（GLTFMeshData）
 * - renderers/ → createMeshRenderer() 做机械转换（数据 → GPU 资源）
 * - scenes/    → 决定用什么 shader、传什么额外 uniform
 *
 * @example
 * ```ts
 * // scenes/CubeScene.ts 中
 * const meshDataList = await loadGLTF('assets/cube/', 'cube1')
 * for (const data of meshDataList) {
 *   const renderer = await createMeshRenderer(gl, {
 *     meshData: data,
 *     vertexShaderPath: ShaderPaths.DIRECT_LIGHT_VERTEX,
 *     fragmentShaderPath: ShaderPaths.DIRECT_LIGHT_FRAGMENT,
 *     extraUniforms: {
 *       uLightVP: { type: UniformType.MATRIX_4FV, value: lightVPMatrix },
 *       uShadowMap: { type: UniformType.TEXTURE_2D, value: shadowFBO.getTexture(0) }
 *     }
 *   })
 *   renderers.push(renderer)
 * }
 * ```
 */
export async function createMeshRendererFromGLTF(
  gl: WebGLRenderingContext,
  config: MeshRendererFromGLTFConfig
): Promise<MeshRenderer> {
  const { data, vertShaderPath, fragShaderPath, extraUniforms, rendererName } = config

  // ---- Step 1: GLTFMeshData → Mesh ----
  const mesh = createMeshFromData(gl, data)

  // ---- Step 2: 创建纹理 & Step 3: 组装 Material ----
  let material: Material
  if (config.material) {
    // 调用方提供完整 Material
    material = config.material
  } else {
    // 工厂自动生成
    // ---- Step 2: 创建纹理 ----
    // const diffuseTexture = createDiffuseTexture(gl, gltfMeshData)
    // const normalTexture = createNormalTexture(gl, gltfMeshData)
    const textureMap: Map<string, Texture> = createTexturesFromGLTF(gl, data)

    // ---- Step 3: 组装 Material ----
    const uniforms: Uniforms = {
      // PBR 标量参数
      uDiffuseColor: { type: UniformType.THREE_FV, value: data.diffuseColor },
      uMetalness: { type: UniformType.ONE_F, value: data.metalness },
      uRoughness: { type: UniformType.ONE_F, value: data.roughness },
      uEmissiveColor: { type: UniformType.THREE_FV, value: data.emissiveColor },
      uEmissiveIntensity: { type: UniformType.ONE_F, value: data.emissiveIntensity }
    }
    // 把自动创建的纹理全部加入 uniforms
    for (const [uniformName, tex] of textureMap) {
      uniforms[uniformName] = { type: UniformType.TEXTURE_2D, value: tex.glTexture }
    }

    // 用户额外 uniform（覆盖默认值）
    if (extraUniforms) {
      Object.assign(uniforms, extraUniforms)
    }
    //     console.log('[function createMeshRendererFromGLTF]', uniforms)
    material = new Material(`${data.name}_Material<${rendererName}>`, uniforms)
  }

  // ---- Step 4: 创建 Shader ----
  const shader = await Shader.createShader(gl, vertShaderPath, fragShaderPath)

  // ---- Step 5: 缓存 attri & uniform location ----
  //    与 BaseRenderer 构造函数里的调用重复。新实现下重复调用只是幂等命中 VAO 缓存，
  //    但没有意义，删掉更清晰
  // mesh.cacheAttriLocations(shader)
  material.cacheUniformLocations(shader)

  // ---- Step 6: 组装 MeshRenderer ----
  const meshRenderer = new MeshRenderer(gl, mesh, material, shader, rendererName)

  return meshRenderer
}

// ============================================================
//  内部辅助函数
// ============================================================

/** GLTFMeshData → Mesh（纯数据 → GPU 顶点数据） */
function createMeshFromData(gl: WebGLRenderingContext, data: GLTFMeshData): Mesh {
  const attriData: AttributeData[] = [
    {
      name: 'aVertexPosition',
      array: data.positions,
      size: 3,
      type: gl.FLOAT
    }
  ]

  if (data.normals) {
    attriData.push({
      name: 'aNormalPosition',
      array: data.normals,
      size: 3,
      type: gl.FLOAT
    })
  }

  if (data.uvs) {
    attriData.push({
      name: 'aTextureCoord',
      array: data.uvs,
      size: 2,
      type: gl.FLOAT
    })
  }

  if (data.tangents) {
    attriData.push({
      name: 'aTangent',
      array: data.tangents,
      size: 4, // vec4: xyz=tangent方向, w=handedness
      type: gl.FLOAT
    })
  }

  if (data.colors) {
    attriData.push({
      name: 'aColor',
      array: data.colors,
      size: 3,
      type: gl.FLOAT
    })
  }

  const mesh = new Mesh(attriData, data.indices, data.transform, data.name, gl)

  return mesh
}

/** 创建 diffuse 纹理（有图片用图片，没有用纯色） */
// function createDiffuseTexture(gl: WebGLRenderingContext, data: GLTFMeshData): Texture {
//   const tex = new Texture(gl)

//   if (data.diffuseImage) {
//     tex.createFromImage(data.diffuseImage)
//   } else {
//     tex.createFromColor(data.diffuseColor, true)
//   }

//   return tex
// }

/** 创建 normal 纹理（有图片用图片，没有用默认朝上法线） */
// function createNormalTexture(gl: WebGLRenderingContext, data: GLTFMeshData): Texture {
//   const tex = new Texture(gl)

//   if (data.normalImage) {
//     tex.createFromImage(data.normalImage)
//   } else {
//     tex.createFromColor([0.5, 0.5, 1.0], false)
//   }

//   return tex
// }
