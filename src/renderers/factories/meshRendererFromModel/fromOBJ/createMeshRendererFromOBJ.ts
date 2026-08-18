import { logger } from '@/logging/Logger'
import { OBJMeshData } from '@/loaders/types/OBJMeshData'
import { MeshRendererFromOBJConfig } from '../types/MeshRendererFromOBJConfig'
import { Mesh } from '@/objects/Mesh'
import { Texture } from '@/textures/Texture'
import { Uniforms, UniformType } from '@/materials/types/Material'
import { Material } from '@/materials/Material'
import { Shader } from '@/shaders/Shader'
import { MeshRenderer } from '../../../MeshRenderer'
import { AttributeData } from '@/objects/types/Mesh'
import { createTexturesFromOBJ } from './createTexturesFromOBJ'

export async function createMeshRendererFromOBJ(
  gl: WebGLRenderingContext,
  config: MeshRendererFromOBJConfig
): Promise<MeshRenderer> {
  const { data, vertShaderPath, fragShaderPath, extraUniforms, rendererName } = config

  // ---- Step 1: OBJMeshData → Mesh ----
  const mesh = createMeshFromData(gl, data)

  // ---- Step 2: 创建纹理 & Step 3: 组装 Material ----
  let material: Material
  if (config.material) {
    // 调用方提供完整 Material
    material = config.material
  } else {
    // 工厂自动生成
    // ---- Step 2: 创建纹理 ----
    // const diffuseMap = createDiffuseTexture(gl, data)
    // const specularMap = createSpecularTexture(gl, data)
    // const normalMap = createNormalTexture(gl, data)
    const textureMap: Map<string, Texture> = createTexturesFromOBJ(gl, data)

    // ---- Step 3: 组装 Material ----
    const uniforms: Uniforms = {
      // Phong 标量参数
      uDiffuseColor: { type: UniformType.THREE_FV, value: data.diffuseColor },
      uSpecularColor: { type: UniformType.THREE_FV, value: data.specularColor },
      uShininess: { type: UniformType.ONE_F, value: data.shininess }
    }

    // 把自动创建的纹理全部加入 uniforms
    for (const [uniformName, tex] of textureMap) {
      uniforms[uniformName] = { type: UniformType.TEXTURE_2D, value: tex.glTexture }
    }

    // 用户额外 uniform（覆盖默认值）
    if (extraUniforms) {
      Object.assign(uniforms, extraUniforms)
    }
    logger.debug('[function createMeshRendererFromOBJ]', uniforms)
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
  const meshRenderer = new MeshRenderer(
    gl,
    mesh,
    material,
    shader,
    `[createMeshRendererFromOBJ] ${rendererName}`
  )

  return meshRenderer
}

// ============================================================
//  内部辅助函数
// ============================================================

function createMeshFromData(gl: WebGLRenderingContext, data: OBJMeshData): Mesh {
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

  const mesh = new Mesh(
    attriData,
    data.indices,
    data.transform,
    `[createMeshFromData] ${data.name}`,
    gl
  )

  return mesh
}

/** 创建 diffuse 贴图（map_Kd），没有图片时用 Kd 颜色 */
// function createDiffuseTexture(gl: WebGLRenderingContext, data: OBJMeshData): Texture {
//   const tex = new Texture(gl)

//   if (data.diffuseImage) {
//     tex.createFromImage(data.diffuseImage)
//   } else {
//     // 用 Kd 颜色作为纯色纹理
//     const kd = data.diffuseColor ?? [0.8, 0.8, 0.8]
//     tex.createFromColor(kd, true)
//   }

//   return tex
// }

/** 创建 specular 贴图（map_Ks），没有图片时用 specularColor 纯色 */
// function createSpecularTexture(gl: WebGLRenderingContext, data: OBJMeshData): Texture {
//   const tex = new Texture(gl)

//   if (data.specularImage) {
//     tex.createFromImage(data.specularImage)
//   } else {
//     tex.createFromColor(data.specularColor, true)
//   }

//   return tex
// }

/** 创建 normal 贴图，没有图片时用默认朝上法线 */
// function createNormalTexture(gl: WebGLRenderingContext, data: OBJMeshData): Texture {
//   const tex = new Texture(gl)

//   if (data.normalImage) {
//     tex.createFromImage(data.normalImage)
//   } else {
//     tex.createFromColor([0.5, 0.5, 1.0], false)
//   }

//   return tex
// }
