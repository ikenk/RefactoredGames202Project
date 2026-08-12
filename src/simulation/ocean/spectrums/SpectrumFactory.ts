import type { SpectrumSettings } from './types/SpectrumSettings'
import { JONSWAPSpectrum } from './JONSWAPSpectrum'
import { PhillipsSpectrum } from './PhillipsSpectrum'
import type {
  PhillipsSpectrumConfig,
  ResolvedPhillipsSpectrumConfig
} from './types/PhillipsSpectrumConfig'
// import { SpectrumFactory } from './types/SpectrumFactory'
// import { SpectrumEvaluationContext } from './types/SpectrumEvaluationContext'
import { SpectrumModelConfig } from './types/SpectrumModelConfig'
import { Spectrum } from './Spectrum'
import { assertNever } from '@/errors/helper/helpers'
import { CapillarySpectrum } from './CapillarySpectrum'
import {
  CapillarySpectrumConfig,
  ResolvedCapillarySpectrumConfig
} from './types/CapillarySpectrumConfig'

const PHILLIPS_ENGINEERING_PRESET = {
  amplitude: 0.008,
  opposingWaveDamping: 0.3
} as const

const CAPILLARY_ENGINEERING_PRESET = {
  baseAmplitude: 0.001,
  cutoffWavenumber: 100,
  surfaceTension: 0.074,
  waterDensity: 1000
} as const

/**
 * 从一层显式的模型配置创建 Spectrum。
 *
 * 该工厂只负责模型选择、模型参数验证和默认值补全；
 * 不再读取 OceanParams，也不校验 SpectrumEvaluationContext。
 */
export function createSpectrum(config: SpectrumModelConfig): Spectrum {
  switch (config.model) {
    case 'jonswap':
      return new JONSWAPSpectrum({
        primary: resolveJONSWAPSettings(config.primary, 'primary'),
        secondary:
          config.secondary === undefined
            ? undefined
            : resolveJONSWAPSettings(config.secondary, 'secondary')
      })

    case 'phillips':
      return createPhillipsSpectrum(config)

    case 'capillary':
      return createCapillarySpectrum(config)

    default:
      return assertNever(config, '[SpectrumFactory] unsupported spectrum model')
  }
}

/**
 * 创建按 cascade 层工作的 Spectrum 工厂。
 *
 * 多层海洋的每一层都有独立的 `spectrum0`/`spectrum1`，因此不能只创建一个
 * JONSWAPSpectrum 再让所有层共享。返回的函数会针对每层参数执行一次校验并
 * 创建不可变 Spectrum，之后 N×N 采样阶段不再进行兜底。
 */
// export function createSpectrumFactory(options: SpectrumFactoryOptions): SpectrumFactory {
//   return (params) => {
//     validateEvaluationContext(params)

//     switch (options.model) {
//       case 'phillips':
//         return createPhillipsSpectrum({
//           windSpeed: requireDefined(params.windSpeed, 'windSpeed'),
//           windDirection: requireDefined(params.windDirection, 'windDirection'),
//           amplitude: options.amplitude,
//           opposingWaveDamping: options.opposingWaveDamping
//         })

//       case 'jonswap':
//         return new JONSWAPSpectrum({
//           primary: resolveJONSWAPSettings(requireDefined(params.spectrum0, 'spectrum0'), 'primary'),
//           secondary:
//             params.spectrum1 === undefined
//               ? undefined
//               : resolveJONSWAPSettings(params.spectrum1, 'secondary')
//         })
//     }
//   }
// }

// ==================== creator ====================

// ----- JONSWAP -----
function resolveJONSWAPSettings(
  settings: Readonly<SpectrumSettings>,
  path: 'primary' | 'secondary'
): Readonly<SpectrumSettings> {
  return Object.freeze({
    scale: requireNonNegative(settings.scale, `${path}.scale`),
    windSpeed: requirePositive(settings.windSpeed, `${path}.windSpeed`),
    windDirection: normalizeDegrees(requireFinite(settings.windDirection, `${path}.windDirection`)),
    fetch: requirePositive(settings.fetch, `${path}.fetch`),
    spreadBlend: requireInClosedRange(settings.spreadBlend, `${path}.spreadBlend`, 0, 1),
    swell: requireInClosedRange(settings.swell, `${path}.swell`, 0, 1),
    peakEnhancement: requireAtLeast(settings.peakEnhancement, `${path}.peakEnhancement`, 1),
    shortWavesFade: requireNonNegative(settings.shortWavesFade, `${path}.shortWavesFade`)
  })
}

// ----- Phillips -----
/**
 * 校验并解析 Phillips 配置，再创建只负责计算的实例。
 */
export function createPhillipsSpectrum(config: PhillipsSpectrumConfig): PhillipsSpectrum {
  const windSpeed = requirePositive(config.windSpeed, 'windSpeed')
  const windDirection = requireDefined(config.windDirection, 'windDirection')
  const windX = requireFinite(windDirection.x, 'windDirection.x')
  const windY = requireFinite(windDirection.y, 'windDirection.y')
  const windLength = Math.hypot(windX, windY)

  if (windLength <= 1e-8) {
    throw new RangeError('[SpectrumFactory] windDirection must be a non-zero vector')
  }

  const resolved: ResolvedPhillipsSpectrumConfig = {
    windSpeed,
    windDirection: Object.freeze({
      x: windX / windLength,
      y: windY / windLength
    }),
    amplitude: requireNonNegative(
      config.amplitude ?? PHILLIPS_ENGINEERING_PRESET.amplitude,
      'amplitude'
    ),
    opposingWaveDamping: requireInClosedRange(
      config.opposingWaveDamping ?? PHILLIPS_ENGINEERING_PRESET.opposingWaveDamping,
      'opposingWaveDamping',
      0,
      1
    )
  }

  return new PhillipsSpectrum(Object.freeze(resolved))
}

// ----- Capillary -----
/**
 * 校验并解析 Capillary 配置，再创建只负责计算的实例。
 */
export function createCapillarySpectrum(config: CapillarySpectrumConfig): CapillarySpectrum {
  const resolved: ResolvedCapillarySpectrumConfig = {
    baseAmplitude: requireNonNegative(
      config.baseAmplitude ?? CAPILLARY_ENGINEERING_PRESET.baseAmplitude,
      'baseAmplitude'
    ),
    cutoffWavenumber: requirePositive(
      config.cutoffWavenumber ?? CAPILLARY_ENGINEERING_PRESET.cutoffWavenumber,
      'cutoffWavenumber'
    ),
    surfaceTension: requirePositive(
      config.surfaceTension ?? CAPILLARY_ENGINEERING_PRESET.surfaceTension,
      'surfaceTension'
    ),
    waterDensity: requirePositive(
      config.waterDensity ?? CAPILLARY_ENGINEERING_PRESET.waterDensity,
      'waterDensity'
    )
  }

  return new CapillarySpectrum(Object.freeze(resolved))
}

// ==================== helper ====================

function requireDefined<T>(value: T | undefined, path: string): T {
  if (value === undefined) {
    throw new TypeError(`[SpectrumFactory] ${path} is required`)
  }
  return value
}

function requireFinite(value: number, path: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`[SpectrumFactory] ${path} must be a finite number; received ${value}`)
  }
  return value
}

function requirePositive(value: number, path: string): number {
  const finiteValue = requireFinite(value, path)
  if (finiteValue <= 0) {
    throw new RangeError(`[SpectrumFactory] ${path} must be greater than 0; received ${value}`)
  }
  return finiteValue
}

function requireNonNegative(value: number, path: string): number {
  const finiteValue = requireFinite(value, path)
  if (finiteValue < 0) {
    throw new RangeError(`[SpectrumFactory] ${path} must be at least 0; received ${value}`)
  }
  return finiteValue
}

function requireAtLeast(value: number, path: string, minimum: number): number {
  const finiteValue = requireFinite(value, path)
  if (finiteValue < minimum) {
    throw new RangeError(`[SpectrumFactory] ${path} must be at least ${minimum}; received ${value}`)
  }
  return finiteValue
}

function requireInClosedRange(
  value: number,
  path: string,
  minimum: number,
  maximum: number
): number {
  const finiteValue = requireFinite(value, path)
  if (finiteValue < minimum || finiteValue > maximum) {
    throw new RangeError(
      `[SpectrumFactory] ${path} must be in [${minimum}, ${maximum}]; received ${value}`
    )
  }
  return finiteValue
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}
