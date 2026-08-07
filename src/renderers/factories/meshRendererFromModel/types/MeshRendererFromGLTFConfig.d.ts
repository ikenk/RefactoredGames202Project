import { GLTFMeshData } from '@/loaders/types/GLTFMeshData'
import { Material } from '@/materials/Material'
import { Uniforms } from '@/materials/types/Material'

// ============================================================
//  配置接口
// ============================================================

export interface MeshRendererFromGLTFConfig {
  /** GLTF 加载得到的纯数据 */
  data: GLTFMeshData

  /** shader 路径（由 scene 决定用什么 shader） */
  vertShaderPath: string
  fragShaderPath: string

  /** meshRenderer name */
  rendererName: string

  // 二选一：
  // 方式 A：工厂自动从 data 生成 Material（现有行为）
  extraUniforms?: Uniforms

  // 方式 B：调用方提供完整 Material（新增）
  material?: Material
}
