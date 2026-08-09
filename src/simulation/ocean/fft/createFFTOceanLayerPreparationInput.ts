import type { OceanParams } from './types/OceanParams'
import type { FFTOceanLayerPreparationInput } from './types/FFTOceanLayerPreparationInput'
import type { FFTOceanLayerRuntimeConfig } from './types/FFTOceanLayerRuntimeConfig'
import type { FFTSpectrumEvolutionConfig } from './types/FFTSpectrumEvolutionConfig'
import type { InitialSpectrumConfig } from './types/InitialSpectrumConfig'
import type { SpectrumEvaluationContext } from '../spectrums/types/SpectrumEvaluationContext'

/**
 * 从旧 OceanParams 提取单层 FFT Ocean 准备阶段需要的窄输入。
 *
 * 这是迁移期间的兼容适配器：
 *
 * - OceanParams 只停留在该边界；
 * - prepareFFTOceanLayer 不再认识 OceanParams；
 * - context 必须已经由 resolveSpectrumEvaluationContext 校验完成。
 */
export function createFFTOceanLayerPreparationInput(
  params: OceanParams,
  context: Readonly<SpectrumEvaluationContext>
): FFTOceanLayerPreparationInput {
  const evolutionConfig: FFTSpectrumEvolutionConfig = {
    size: context.size,
    fftResolution: params.fftResolution,
    gravity: context.gravity
  }

  const initialSpectrumConfig: InitialSpectrumConfig =
    params.amplitude === undefined ? {} : { amplitude: params.amplitude }

  const runtimeConfig: FFTOceanLayerRuntimeConfig = {
    choppiness: [params.choppiness[0], params.choppiness[1]],
    foamDecayRate: params.foamDecayRate ?? 0.05,
    foamAdd: params.foamAdd ?? 0.1,
    foamBias: params.foamBias ?? 0.2,
    foamPower: params.foamPower ?? 1.5
  }

  return {
    context,
    evolutionConfig,
    initialSpectrumConfig,
    runtimeConfig
  }
}
