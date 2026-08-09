import { describe, expect, it } from 'vitest'
import { createFFTOceanLayerPreparationInput } from '@/simulation/ocean/fft/createFFTOceanLayerPreparationInput'
import type { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'
import type { SpectrumEvaluationContext } from '@/simulation/ocean/spectrums/types/SpectrumEvaluationContext'
import type { Vec2 } from '@/math/types/math'

const CONTEXT: Readonly<SpectrumEvaluationContext> = Object.freeze({
  size: 64,
  gravity: 9.81,
  depth: 80,
  kMin: 0.1,
  kMax: 8
})

function createOceanParams(overrides: Partial<OceanParams> = {}): OceanParams {
  return {
    size: 64,
    fftResolution: 256,
    gravity: 9.81,
    choppiness: [1, 1],
    ...overrides
  }
}

describe('createFFTOceanLayerPreparationInput', () => {
  it('从 OceanParams 提取 FFT 层准备阶段所需的窄配置', () => {
    const input = createFFTOceanLayerPreparationInput(
      createOceanParams({
        amplitude: 1.25,
        choppiness: [1.2, 1.4],
        foamDecayRate: 0.08,
        foamAdd: 0.12,
        foamBias: 0.24,
        foamPower: 1.8,
        layerContribute: 0.75
      }),
      CONTEXT
    )

    expect(input).toEqual({
      context: CONTEXT,
      evolutionConfig: {
        size: 64,
        fftResolution: 256,
        gravity: 9.81
      },
      initialSpectrumConfig: {
        amplitude: 1.25
      },
      runtimeConfig: {
        choppiness: [1.2, 1.4],
        foamDecayRate: 0.08,
        foamAdd: 0.12,
        foamBias: 0.24,
        foamPower: 1.8
      }
    })
  })

  it('只在 amplitude 和 foam 参数缺省时补兼容值', () => {
    const input = createFFTOceanLayerPreparationInput(createOceanParams(), CONTEXT)

    expect(input.initialSpectrumConfig).toEqual({})

    expect(input.runtimeConfig).toEqual({
      choppiness: [1, 1],
      foamDecayRate: 0.05,
      foamAdd: 0.1,
      foamBias: 0.2,
      foamPower: 1.5
    })
  })

  it('保留 amplitude 和 foam 参数中的显式零值', () => {
    const input = createFFTOceanLayerPreparationInput(
      createOceanParams({
        amplitude: 0,
        foamDecayRate: 0,
        foamAdd: 0,
        foamBias: 0,
        foamPower: 0
      }),
      CONTEXT
    )

    expect(input.initialSpectrumConfig).toEqual({
      amplitude: 0
    })

    expect(input.runtimeConfig).toMatchObject({
      foamDecayRate: 0,
      foamAdd: 0,
      foamBias: 0,
      foamPower: 0
    })
  })

  it('复制 choppiness，避免后续编辑 OceanParams 污染准备输入', () => {
    const choppiness: Vec2 = [1.25, 1.5]
    const params = createOceanParams({ choppiness })

    const input = createFFTOceanLayerPreparationInput(params, CONTEXT)

    expect(input.runtimeConfig.choppiness).not.toBe(choppiness)

    choppiness[0] = 99

    expect(input.runtimeConfig.choppiness).toEqual([1.25, 1.5])
  })
})
