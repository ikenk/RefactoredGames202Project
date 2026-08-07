import { describe, expect, it } from 'vitest'
import { InitialSpectrum } from '@/simulation/ocean/fft/InitialSpectrum'
import { prepareFFTOceanLayer } from '@/simulation/ocean/fft/prepareFFTOceanLayer'
import type { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'
import type { Vec2 } from '@/math/types/math'
import type { Spectrum } from '@/simulation/ocean/spectrums/Spectrum'
import type { SpectrumEvaluationContext } from '@/simulation/ocean/spectrums/types/SpectrumEvaluationContext'

const CONTEXT: SpectrumEvaluationContext = {
  size: 64,
  gravity: 9.81
}

const CONSTANT_SPECTRUM: Spectrum = {
  calculateH0Magnitude: () => 1
}

function createOceanParams(overrides: Partial<OceanParams> = {}): OceanParams {
  return {
    size: 64,
    fftResolution: 2,
    gravity: 9.81,
    choppiness: [1, 1],
    ...overrides
  }
}

describe('prepareFFTOceanLayer', () => {
  it('只输出 GPU 需要的窄配置，不再泄漏完整 OceanParams', () => {
    const params = createOceanParams({
      foamDecayRate: 0.08,
      foamAdd: 0.12,
      foamBias: 0.24,
      foamPower: 1.8
    })

    const prepared = prepareFFTOceanLayer(params, CONTEXT, CONSTANT_SPECTRUM)

    expect(prepared.evolutionConfig).toEqual({
      size: 64,
      fftResolution: 2,
      gravity: 9.81
    })
    expect(prepared.runtimeConfig).toEqual({
      choppiness: [1, 1],
      foamDecayRate: 0.08,
      foamAdd: 0.12,
      foamBias: 0.24,
      foamPower: 1.8
    })
    expect(Object.hasOwn(prepared, 'params')).toBe(false)
  })

  it('只在 foam 参数缺省时补兼容值，并保留显式的零值', () => {
    const withDefaults = prepareFFTOceanLayer(createOceanParams(), CONTEXT, CONSTANT_SPECTRUM)
    const withZeroes = prepareFFTOceanLayer(
      createOceanParams({
        foamDecayRate: 0,
        foamAdd: 0,
        foamBias: 0,
        foamPower: 0
      }),
      CONTEXT,
      CONSTANT_SPECTRUM
    )

    expect(withDefaults.runtimeConfig).toMatchObject({
      foamDecayRate: 0.05,
      foamAdd: 0.1,
      foamBias: 0.2,
      foamPower: 1.5
    })
    expect(withZeroes.runtimeConfig).toMatchObject({
      foamDecayRate: 0,
      foamAdd: 0,
      foamBias: 0,
      foamPower: 0
    })
  })

  it('复制 choppiness，避免后续编辑 OceanParams 污染 prepared snapshot', () => {
    const choppiness: Vec2 = [1.25, 1.5]
    const params = createOceanParams({ choppiness })

    const prepared = prepareFFTOceanLayer(params, CONTEXT, CONSTANT_SPECTRUM)

    expect(prepared.runtimeConfig.choppiness).not.toBe(choppiness)

    choppiness[0] = 99

    expect(prepared.runtimeConfig.choppiness).toEqual([1.25, 1.5])
  })

  it('在 ComputePass 外部使用指定 context 生成 InitialSpectrum', () => {
    const receivedContexts: SpectrumEvaluationContext[] = []
    const spectrum: Spectrum = {
      calculateH0Magnitude: (_kx, _kz, context) => {
        receivedContexts.push(context)
        return 1
      }
    }

    const prepared = prepareFFTOceanLayer(createOceanParams(), CONTEXT, spectrum)

    expect(prepared.initialSpectrum).toBeInstanceOf(InitialSpectrum)
    expect(prepared.initialSpectrum.getH0().N).toBe(2)

    // N=2 有四个采样点，其中 DC 点被 InitialSpectrum 跳过。
    expect(receivedContexts).toHaveLength(3)
    expect(receivedContexts).toEqual([CONTEXT, CONTEXT, CONTEXT])
  })
})
