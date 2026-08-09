import { InitialSpectrum } from './InitialSpectrum'
// import type { OceanParams } from './types/OceanParams'
import type { PreparedFFTOceanLayer } from './types/PreparedFFTOceanLayer'
import type { Spectrum } from '../spectrums/Spectrum'
// import { SpectrumEvaluationContext } from '../spectrums/types/SpectrumEvaluationContext'
// import { FFTSpectrumEvolutionConfig } from './types/FFTSpectrumEvolutionConfig'
// import { InitialSpectrumConfig } from './types/InitialSpectrumConfig'
// import { FFTOceanLayerRuntimeConfig } from './types/FFTOceanLayerRuntimeConfig'
import { FFTOceanLayerPreparationInput } from './types/FFTOceanLayerPreparationInput'

/**
 * 将已经由上层选定、校验完成的 Spectrum 采样为单层初始频谱。
 *
 * 该函数属于 CPU 侧装配边界，不创建 Shader、Texture 或 FBO。
 */
// export function prepareFFTOceanLayer(
//   params: OceanParams,
//   spectrum: Spectrum
// ): PreparedFFTOceanLayer {
//   return {
//     params,
//     initialSpectrum: new InitialSpectrum(params, spectrum)
//   }
// }

/**
 * 将已经由上层完成提取和校验的输入装配为单层 FFT Ocean CPU 数据。
 *
 * 该函数：
 *
 * - 不读取旧 OceanParams；
 * - 不选择或创建 Spectrum；
 * - 不创建 Shader、Texture 或 FBO；
 * - 只负责生成 InitialSpectrum，并组装 ComputePass 的窄输入。
 */
export function prepareFFTOceanLayer(
  input: FFTOceanLayerPreparationInput,
  spectrum: Spectrum
): PreparedFFTOceanLayer {
  const { context, evolutionConfig, initialSpectrumConfig, runtimeConfig } = input

  return {
    evolutionConfig,
    runtimeConfig,
    initialSpectrum: new InitialSpectrum(evolutionConfig, initialSpectrumConfig, context, spectrum)
  }
}
