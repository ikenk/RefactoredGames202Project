import type { SpectrumEvaluationContext } from '../../spectrums/types/SpectrumEvaluationContext'
import type { FFTOceanLayerRuntimeConfig } from './FFTOceanLayerRuntimeConfig'
import type { FFTSpectrumEvolutionConfig } from './FFTSpectrumEvolutionConfig'
import type { InitialSpectrumConfig } from './InitialSpectrumConfig'

/**
 * 创建单层 FFT Ocean CPU 初始数据所需的窄输入。
 *
 * 该接口只包含 InitialSpectrum 和后续 GPU 计算真正需要的数据，
 * 不暴露场景层使用的完整 OceanParams。
 */
export interface FFTOceanLayerPreparationInput {
  /**
   * 波谱求值时使用的、已经由上层校验完成的物理环境。
   */
  readonly context: Readonly<SpectrumEvaluationContext>

  /**
   * GPU 实时频谱演化所需的 FFT 网格与重力参数。
   */
  readonly evolutionConfig: FFTSpectrumEvolutionConfig

  /**
   * CPU 初始频谱 h₀(k) 生成阶段使用的配置。
   */
  readonly initialSpectrumConfig: InitialSpectrumConfig

  /**
   * 逐帧合成位移、法线与泡沫时使用的运行参数。
   */
  readonly runtimeConfig: FFTOceanLayerRuntimeConfig
}
