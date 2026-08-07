import { FFTOceanMaterialConfig } from '@/materials/water/types/FFTOceanMaterialConfig'
import { Transform } from '@/objects/utils/Transform'
import { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'
import { RenderingMode } from '../../types/RenderingMode'

/**
 * FFT 海洋渲染器的完整配置（重构版 · 单层）
 *
 * 变更点（对比原 FFTOceanRenderManagerConfig）：
 * - 去掉了 CascadeConfig（含 blendMode, enabled, layerParamsSet[]）
 * - 替换为 OceanParams（单层参数）
 * - renderingMode 提升为顶层字段（原来嵌套在 CascadeConfig 里）
 */
// export interface FFTOceanConfig {
//   // ==================== Mesh ====================
//   /** 模型变换 */
//   transform: Transform
//   /** mesh 物理尺寸（通常 = oceanParams.size） */
//   surfaceSize: number
//   /** mesh 顶点密度（一定要和 oceanParams 中的 fftResolution(Texture Resolution) 区分开） */
//   surfaceMeshResolution: number
//   // ==================== Material ====================
//   /** 材质参数 */
//   // materialParams: FFTOceanMaterialParams
//   materialConfig: FFTOceanMaterialConfig
//   // ==================== Renderer ====================
//   /** 渲染模式 */
//   renderingMode: RenderingMode
//   // ==================== FFT Calculate ====================
//   /** 海洋物理参数（单层） -- 纯频谱参数（给 FFT 计算用）*/
//   oceanParams: OceanParams
// }
export interface FFTOceanConfig {
  // ==================== Mesh ====================
  /** 模型变换 */
  transform: Transform
  /** mesh 物理尺寸（通常 = oceanParams.size） */
  surfaceSize: number
  /** mesh 顶点密度（一定要和 oceanParams 中的 fftResolution(Texture Resolution) 区分开） */
  surfaceMeshResolution: number
  // ==================== Material ====================
  /** 材质参数 */
  // materialParams: FFTOceanMaterialParams
  materialConfig: FFTOceanMaterialConfig
  // ==================== Renderer ====================
  /** 渲染模式 */
  renderingMode: RenderingMode
  // ==================== FFT Calculate ====================
  /** 海洋物理参数（单层） -- 纯频谱参数（给 FFT 计算用） */
  oceanParams: OceanParams
}
