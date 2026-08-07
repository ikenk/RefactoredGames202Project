import { InitialSpectrum } from './InitialSpectrum'
import type { OceanParams } from './types/OceanParams'
import type { PreparedFFTOceanLayer } from './types/PreparedFFTOceanLayer'
import type { Spectrum } from '../spectrums/Spectrum'
import { SpectrumEvaluationContext } from '../spectrums/types/SpectrumEvaluationContext'
import { FFTSpectrumEvolutionConfig } from './types/FFTSpectrumEvolutionConfig'
import { InitialSpectrumConfig } from './types/InitialSpectrumConfig'
import { FFTOceanLayerRuntimeConfig } from './types/FFTOceanLayerRuntimeConfig'

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

export function prepareFFTOceanLayer(
  params: OceanParams,
  context: SpectrumEvaluationContext,
  spectrum: Spectrum
): PreparedFFTOceanLayer {
  const evolutionConfig: FFTSpectrumEvolutionConfig = {
    size: context.size,
    fftResolution: params.fftResolution,
    gravity: context.gravity
  }

  const initialSpectrumConfig: InitialSpectrumConfig = {
    amplitude: params.amplitude
  }

  const runtimeConfig: FFTOceanLayerRuntimeConfig = {
    choppiness: [params.choppiness[0], params.choppiness[1]],
    foamDecayRate: params.foamDecayRate ?? 0.05,
    foamAdd: params.foamAdd ?? 0.1,
    foamBias: params.foamBias ?? 0.2,
    foamPower: params.foamPower ?? 1.5
  }

  return {
    evolutionConfig,
    runtimeConfig,
    initialSpectrum: new InitialSpectrum(evolutionConfig, initialSpectrumConfig, context, spectrum)
  }
}
