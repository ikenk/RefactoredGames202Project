import type { FFTOceanLayerBlendConfig } from '@/materials/water/types/FFTOceanLayerBlendConfig'
import type { FFTOceanLayerPreparationInput } from '@/simulation/ocean/fft/types/FFTOceanLayerPreparationInput'
import type { SpectrumModelConfig } from '@/simulation/ocean/spectrums/types/SpectrumModelConfig'

/**
 * 一层可编辑配置经过场景边界适配后，交给三个底层职责的窄输入。
 *
 * - `modelConfig` 交给 `createSpectrum()`；
 * - `preparationInput` 交给 `prepareFFTOceanLayer()`；
 * - `blendConfig` 交给最终水面材质。
 *
 * 三组数据均由适配器重新创建，不再引用场景和 GUI 持有的顶层对象。
 */
export interface FFTOceanLayerBuildInputs {
  /** 波谱工厂的模型选择与模型专属参数。 */
  readonly modelConfig: SpectrumModelConfig

  /** 初始频谱、实时演化与逐帧合成需要的窄输入。 */
  readonly preparationInput: FFTOceanLayerPreparationInput

  /** 最终材质只需要知道的单层混合参数。 */
  readonly blendConfig: FFTOceanLayerBlendConfig
}
