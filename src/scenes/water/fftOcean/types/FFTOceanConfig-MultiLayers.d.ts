import type { FFTOceanMaterialConfig } from '@/materials/water/types/FFTOceanMaterialConfig'
import type { Transform } from '@/objects/utils/Transform'
import type { RenderingMode } from '@/scenes/water/types/RenderingMode'
import type { FFTOceanLayerAuthoringConfig } from './FFTOceanLayerAuthoringConfig'

/** FFT Ocean 整个场景的可编辑配置。 */
export interface FFTOceanConfig {
  /** 模型变换 */
  transform: Transform

  /** 屏幕上海面 mesh 的物理边长，单位 m。 */
  surfaceSize: number

  /** mesh 顶点密度；与各层 FFT 纹理分辨率相互独立。 */
  surfaceMeshResolution: number

  /** 最终水面材质的可编辑参数。 */
  materialConfig: FFTOceanMaterialConfig

  /** 渲染模式 */
  renderingMode: RenderingMode

  /**
   * 按低频到高频排列的 FFT cascade authoring live state。
   *
   * Scene、GUI 和持久化可以修改这些对象；开始初始化或冷重建时，必须先通过
   * `createFFTOceanLayerBuildInputs()` 生成复制且收窄的底层输入。
   */
  layers: FFTOceanLayerAuthoringConfig[]
}
