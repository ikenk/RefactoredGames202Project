import { describe, expect, it } from 'vitest'
import { createSpectrum } from '@/simulation/ocean/spectrums/SpectrumFactory'
import type { SpectrumEvaluationContext } from '@/simulation/ocean/spectrums/types/SpectrumEvaluationContext'
import type {
  JONSWAPSpectrumModelConfig,
  SpectrumModelConfig
} from '@/simulation/ocean/spectrums/types/SpectrumModelConfig'

const context: SpectrumEvaluationContext = {
  size: 256,
  gravity: 9.81
}

const primary = {
  scale: 1,
  windSpeed: 12,
  windDirection: 25,
  fetch: 100_000,
  spreadBlend: 0.8,
  swell: 0.2,
  peakEnhancement: 3.3,
  shortWavesFade: 0.01
}

function createJONSWAPConfig(
  overrides: Partial<JONSWAPSpectrumModelConfig> = {}
): JONSWAPSpectrumModelConfig {
  return {
    model: 'jonswap',
    primary,
    ...overrides
  }
}

describe('createSpectrum', () => {
  it('从 JONSWAP 模型配置创建可求值的 Spectrum', () => {
    const spectrum = createSpectrum(createJONSWAPConfig())

    const magnitude = spectrum.calculateH0Magnitude(0.15, 0.08, context)

    expect(magnitude).toBeGreaterThan(0)
    expect(Number.isFinite(magnitude)).toBe(true)
  })

  it('为不同配置创建独立实例，并使用各自的 JONSWAP 能量缩放', () => {
    const first = createSpectrum(createJONSWAPConfig())
    const second = createSpectrum(
      createJONSWAPConfig({
        primary: {
          ...primary,
          scale: 4
        }
      })
    )

    const firstMagnitude = first.calculateH0Magnitude(0.15, 0.08, context)
    const secondMagnitude = second.calculateH0Magnitude(0.15, 0.08, context)

    expect(first).not.toBe(second)
    expect(secondMagnitude / firstMagnitude).toBeCloseTo(2, 10)
  })

  it('从 Phillips 模型配置创建可求值的 Spectrum', () => {
    const config: SpectrumModelConfig = {
      model: 'phillips',
      windSpeed: 12,
      windDirection: { x: 2, y: 0 }
    }

    const spectrum = createSpectrum(config)

    expect(spectrum.calculateH0Magnitude(0.15, 0.08, context)).toBeGreaterThan(0)
  })

  it('让 Capillary 配置接管原来的硬编码参数', () => {
    const defaultSpectrum = createSpectrum({ model: 'capillary' })
    const disabledSpectrum = createSpectrum({
      model: 'capillary',
      baseAmplitude: 0
    })

    expect(defaultSpectrum.calculateH0Magnitude(10, 0, context)).toBeGreaterThan(0)
    expect(disabledSpectrum.calculateH0Magnitude(10, 0, context)).toBe(0)
  })

  it('在 Factory 边界拒绝非法的 JONSWAP 模型参数', () => {
    expect(() =>
      createSpectrum(
        createJONSWAPConfig({
          primary: {
            ...primary,
            windSpeed: 0
          }
        })
      )
    ).toThrow('[SpectrumFactory] primary.windSpeed must be greater than 0')
  })

  it('在 Factory 边界拒绝零向量 Phillips 风向', () => {
    expect(() =>
      createSpectrum({
        model: 'phillips',
        windSpeed: 12,
        windDirection: { x: 0, y: 0 }
      })
    ).toThrow('[SpectrumFactory] windDirection must be a non-zero vector')
  })

  it('在 Factory 边界拒绝非法的 Capillary 截止波数', () => {
    expect(() =>
      createSpectrum({
        model: 'capillary',
        cutoffWavenumber: 0
      })
    ).toThrow('[SpectrumFactory] cutoffWavenumber must be greater than 0')
  })

  it('求值时继续保留缺少 depth 的 1000m 兼容行为', () => {
    const spectrum = createSpectrum(createJONSWAPConfig())

    expect(
      spectrum.calculateH0Magnitude(0.15, 0.08, {
        ...context,
        depth: undefined
      })
    ).toBeGreaterThan(0)
  })
})
