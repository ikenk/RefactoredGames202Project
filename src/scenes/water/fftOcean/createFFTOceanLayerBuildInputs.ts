import { assertNever } from '@/errors/helper/helpers'
import type { FFTOceanLayerBlendConfig } from '@/materials/water/types/FFTOceanLayerBlendConfig'
import { resolveFFTGridConfig } from '@/simulation/ocean/fft/resolveFFTGridConfig'
import type { FFTOceanLayerPreparationInput } from '@/simulation/ocean/fft/types/FFTOceanLayerPreparationInput'
import type { FFTOceanLayerRuntimeConfig } from '@/simulation/ocean/fft/types/FFTOceanLayerRuntimeConfig'
import type { FFTSpectrumEvolutionConfig } from '@/simulation/ocean/fft/types/FFTSpectrumEvolutionConfig'
import type { InitialSpectrumConfig } from '@/simulation/ocean/fft/types/InitialSpectrumConfig'
import { resolveSpectrumEvaluationContext } from '@/simulation/ocean/spectrums/resolveSpectrumEvaluationContext'
import type { SpectrumModelConfig } from '@/simulation/ocean/spectrums/types/SpectrumModelConfig'
import type { FFTOceanLayerAuthoringConfig } from './types/FFTOceanLayerAuthoringConfig'
import type { FFTOceanLayerBuildInputs } from './types/FFTOceanLayerBuildInputs'

/**
 * 把场景和 GUI 持有的一层可编辑配置转换为底层模块所需的窄输入。
 *
 * 该函数只做边界工作：复制可变数据、委托网格与求值环境校验，并保留当前的
 * amplitude/foam/blend 缺省语义。模型专属校验仍由后续的 `createSpectrum()` 负责。
 */
export function createFFTOceanLayerBuildInputs(
  layer: FFTOceanLayerAuthoringConfig
): FFTOceanLayerBuildInputs {
  const gridConfig = resolveFFTGridConfig(layer.grid)
  const context = resolveSpectrumEvaluationContext({
    size: gridConfig.size,
    gravity: layer.evaluation.gravity,
    depth: layer.evaluation.depth,
    kMin: layer.evaluation.kMin,
    kMax: layer.evaluation.kMax
  })

  const evolutionConfig: FFTSpectrumEvolutionConfig = {
    size: gridConfig.size,
    fftResolution: gridConfig.fftResolution,
    gravity: context.gravity
  }

  const initialSpectrumConfig: InitialSpectrumConfig =
    layer.initialSpectrum.amplitude === undefined
      ? {}
      : { amplitude: layer.initialSpectrum.amplitude }

  const runtimeConfig: FFTOceanLayerRuntimeConfig = {
    choppiness: [layer.runtime.choppiness[0], layer.runtime.choppiness[1]],
    foamDecayRate: layer.runtime.foamDecayRate ?? 0.05,
    foamAdd: layer.runtime.foamAdd ?? 0.1,
    foamBias: layer.runtime.foamBias ?? 0.2,
    foamPower: layer.runtime.foamPower ?? 1.5
  }

  const preparationInput: FFTOceanLayerPreparationInput = {
    context,
    evolutionConfig,
    initialSpectrumConfig,
    runtimeConfig
  }

  const blendConfig: FFTOceanLayerBlendConfig =
    layer.blend.layerContribute === undefined
      ? {}
      : { layerContribute: layer.blend.layerContribute }

  return {
    modelConfig: copySpectrumModelConfig(layer.spectrum),
    preparationInput,
    blendConfig
  }
}

/**
 * 复制可辨识联合中的模型专属对象，避免 GUI 后续编辑穿透到本次构建输入。
 */
function copySpectrumModelConfig(config: SpectrumModelConfig): SpectrumModelConfig {
  switch (config.model) {
    case 'jonswap':
      return {
        model: 'jonswap',
        primary: { ...config.primary },
        ...(config.secondary === undefined ? {} : { secondary: { ...config.secondary } })
      }

    case 'phillips':
      return {
        model: 'phillips',
        windSpeed: config.windSpeed,
        windDirection: { ...config.windDirection },
        ...(config.amplitude === undefined ? {} : { amplitude: config.amplitude }),
        ...(config.opposingWaveDamping === undefined
          ? {}
          : { opposingWaveDamping: config.opposingWaveDamping })
      }

    case 'capillary':
      return {
        model: 'capillary',
        ...(config.baseAmplitude === undefined ? {} : { baseAmplitude: config.baseAmplitude }),
        ...(config.cutoffWavenumber === undefined
          ? {}
          : { cutoffWavenumber: config.cutoffWavenumber }),
        ...(config.surfaceTension === undefined ? {} : { surfaceTension: config.surfaceTension }),
        ...(config.waterDensity === undefined ? {} : { waterDensity: config.waterDensity })
      }

    default:
      return assertNever(config, '[FFTOceanLayerBuildInputs] unsupported spectrum model')
  }
}
