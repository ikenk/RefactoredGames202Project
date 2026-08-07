import { GBufferMaterial } from '@/materials/deferred/GBufferMaterial-refactor'
import { Mesh } from '@/objects/Mesh'
import { AttributeData } from '@/objects/types/Mesh'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { Shader } from '@/shaders/Shader'
import { Texture } from '@/textures/Texture'
import { GBufferRendererFromGLTFConfig } from './types/GBufferRendererFromGLTFConfig'
import { GLTFMeshData } from '@/loaders/types/GLTFMeshData'

/**
 * GLTFMeshData → GBuffer MeshRenderer
 *
 * 和 createGBufferRendererFromOBJ 的逻辑完全一样，
 * 区别只在输入类型是 GLTFMeshData 而非 OBJMeshData。
 *
 * 为什么不合并成一个函数接受 union 类型？
 * 因为 OBJMeshData 和 GLTFMeshData 虽然字段名类似，但类型定义不同，
 * 各自的 loader 返回各自的类型。合并会导致类型守卫复杂化，
 * 不如直接两个函数，调用方根据自己加载的格式选择。
 */
export async function createGBufferRendererFromGLTF(
  gl: WebGLRenderingContext,
  config: GBufferRendererFromGLTFConfig
): Promise<MeshRenderer> {
  const { data, rendererName } = config
  const ctx = '[createGBufferRendererFromGLTF]'

  // 1. 创建 Mesh
  // GBuffer 只需要 4 种 attribute：position, normal, uv, tangent
  // 不需要 color（GBuffer 不直接输出颜色，diffuse 从贴图采样）
  const mesh = createGBufferMesh(gl, data, `${ctx} ${rendererName}<Mesh>`)

  // 2. 构建 Material
  // 从 OBJMeshData 中提取 diffuse 和 normal map 图片，创建 WebGLTexture，如果模型没有这些贴图，用 fallback 纯色纹理

  // 漫反射贴图：MTL 中的 map_Kd
  const diffuseTex = new Texture(gl)
  if (data.diffuseImage) {
    // 有 MTL 中指定的 map_Kd 图片
    diffuseTex.createFromImage(data.diffuseImage)
  } else {
    // 没有图片，用 diffuseColor（Kd 值）生成 1×1 纯色纹理
    // 第二个参数 true：这是 sRGB 颜色，创建时需要考虑 gamma
    diffuseTex.createFromColor(data.diffuseColor, true)
  }

  // 法线贴图：MTL 中的 map_bump / norm
  const normalTex = new Texture(gl)
  if (data.normalImage) {
    normalTex.createFromImage(data.normalImage)
  } else {
    // (0.5, 0.5, 1.0) 解码后是 (0, 0, 1)，即"不偏移"
    // 经 TBN 变换后等于原始几何法线
    // 第二个参数 false：法线数据是线性空间，不做 gamma
    normalTex.createFromColor([0.5, 0.5, 1.0], false)
  }

  // ---- Step 3: 创建 GBufferMaterial ----
  const material = new GBufferMaterial(
    `${ctx} GBufferMaterial<${rendererName}>`,
    diffuseTex.glTextureOrThrow,
    normalTex.glTextureOrThrow
  )

  // ---- Step 4: 编译 GBuffer Shader ----
  // 和 OBJ 版共享同一个 shader（缓存机制保证不会重复编译）
  const shader = await Shader.createShader(
    gl,
    ShaderPaths.GBUFFER_VERTEX,
    ShaderPaths.GBUFFER_FRAGMENT
  )

  // 4. 缓存 location
  // 把 attribute 和 uniform 的 location 查询结果缓存起来，
  // 避免每帧 draw 时重复调用 gl.getAttribLocation / gl.getUniformLocation
  //    与 BaseRenderer 构造函数里的调用重复。新实现下重复调用只是幂等命中 VAO 缓存，
  //    但没有意义，删掉更清晰
  // mesh.cacheAttriLocations(shader)
  material.cacheUniformLocations(shader)

  // ---- Step 6: 组装 MeshRenderer ----
  return new MeshRenderer(gl, mesh, material, shader, `${ctx} MeshRenderer<${rendererName}>`)
}

/**
 * GLTFMeshData → Mesh
 *
 * 只创建 GBuffer 需要的 attribute：
 * - aVertexPosition：必需，顶点位置
 * - aNormalPosition：必需，GBuffer [2] 输出世界空间法线
 * - aTextureCoord：必需，采样 uKd 和 uNt
 * - aTangent：可选，如果有则用于更精确的 TBN（否则 shader 用 LocalBasis 近似）
 */
function createGBufferMesh(gl: WebGLRenderingContext, data: GLTFMeshData, label: string): Mesh {
  const attributes: AttributeData[] = [
    {
      name: 'aVertexPosition',
      array: data.positions,
      size: 3,
      type: gl.FLOAT
    }
  ]

  // 法线：GBuffer 必须要法线（输出世界空间法线到 attachment [2]）
  if (data.normals) {
    attributes.push({
      name: 'aNormalPosition',
      array: data.normals,
      size: 3,
      type: gl.FLOAT
    })
  } else {
    console.warn(
      `${label} Model "${data.name}" has no normals, GBuffer normal output will be incorrect`
    )
  }

  // 纹理坐标：GBuffer 需要 UV 来采样漫反射贴图和法线贴图
  if (data.uvs) {
    attributes.push({
      name: 'aTextureCoord',
      array: data.uvs,
      size: 2,
      type: gl.FLOAT
    })
  } else {
    console.warn(`${label} Model "${data.name}" has no UVs, textures will not sample correctly`)
  }

  if (data.tangents) {
    attributes.push({
      name: 'aTangent',
      array: data.tangents,
      size: 4,
      type: gl.FLOAT
    })
  } else {
    console.warn(`${label} Model "${data.name}" has no tangents, TBN coordinates may be inaccurate`)
  }

  return new Mesh(attributes, data.indices, data.transform, label, gl)
}
