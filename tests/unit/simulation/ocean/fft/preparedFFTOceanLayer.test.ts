import { afterEach, describe, expect, it, vi } from 'vitest'
import { InitialSpectrum } from '@/simulation/ocean/fft/InitialSpectrum'
import { prepareFFTOceanLayer } from '@/simulation/ocean/fft/prepareFFTOceanLayer'
import type { FFTOceanLayerPreparationInput } from '@/simulation/ocean/fft/types/FFTOceanLayerPreparationInput'
import type { Spectrum } from '@/simulation/ocean/spectrums/Spectrum'
import type { SpectrumEvaluationContext } from '@/simulation/ocean/spectrums/types/SpectrumEvaluationContext'

const CONTEXT: Readonly<SpectrumEvaluationContext> = Object.freeze({
  size: 64,
  gravity: 9.81
})

const CONSTANT_SPECTRUM: Spectrum = {
  calculateH0Magnitude: () => 1
}

function createPreparationInput(amplitude?: number): FFTOceanLayerPreparationInput {
  return {
    context: CONTEXT,
    evolutionConfig: {
      size: 64,
      fftResolution: 2,
      gravity: 9.81
    },
    initialSpectrumConfig: amplitude === undefined ? {} : { amplitude },
    runtimeConfig: {
      choppiness: [1, 1],
      foamDecayRate: 0.05,
      foamAdd: 0.1,
      foamBias: 0.2,
      foamPower: 1.5
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('prepareFFTOceanLayer', () => {
  it('只输出 ComputePass 需要的窄配置和初始频谱', () => {
    const input = createPreparationInput()

    const prepared = prepareFFTOceanLayer(input, CONSTANT_SPECTRUM)

    expect(prepared.evolutionConfig).toEqual({
      size: 64,
      fftResolution: 2,
      gravity: 9.81
    })

    expect(prepared.runtimeConfig).toEqual({
      choppiness: [1, 1],
      foamDecayRate: 0.05,
      foamAdd: 0.1,
      foamBias: 0.2,
      foamPower: 1.5
    })

    expect(prepared.initialSpectrum).toBeInstanceOf(InitialSpectrum)

    expect(Object.keys(prepared).sort()).toEqual([
      'evolutionConfig',
      'initialSpectrum',
      'runtimeConfig'
    ])
  })

  it('使用输入中的 context 对每个非 DC 采样点求值', () => {
    const receivedContexts: SpectrumEvaluationContext[] = []

    const spectrum: Spectrum = {
      calculateH0Magnitude: (_kx, _kz, context) => {
        receivedContexts.push(context)
        return 1
      }
    }

    const prepared = prepareFFTOceanLayer(createPreparationInput(), spectrum)

    expect(prepared.initialSpectrum.getH0().N).toBe(2)

    // N=2 一共有四个采样点，InitialSpectrum 会跳过 DC 点。
    expect(receivedContexts).toHaveLength(3)
    expect(receivedContexts).toEqual([CONTEXT, CONTEXT, CONTEXT])
  })

  it('把 initialSpectrumConfig.amplitude 应用到生成的 h0', () => {
    let randomCallCount = 0

    vi.spyOn(Math, 'random').mockImplementation(() => {
      const isBoxMullerRadiusInput = randomCallCount % 2 === 0
      randomCallCount += 1

      // sqrt(-2 * ln(exp(-0.5))) = 1
      // cos(2π * 1) = 1
      return isBoxMullerRadiusInput ? Math.exp(-0.5) : 1
    })

    const prepared = prepareFFTOceanLayer(createPreparationInput(2), CONSTANT_SPECTRUM)

    // spectrum=1、amplitude=2、Gaussian=1：
    // h0 的实部 = 2 / sqrt(2) = sqrt(2)
    expect(prepared.initialSpectrum.getH0().getReal(0, 1)).toBeCloseTo(Math.SQRT2, 5)
  })
})
