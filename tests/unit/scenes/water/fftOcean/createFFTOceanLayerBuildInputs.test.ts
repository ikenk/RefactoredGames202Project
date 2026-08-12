import { describe, expect, it } from 'vitest'

import { createFFTOceanLayerBuildInputs } from '@/scenes/water/fftOcean/createFFTOceanLayerBuildInputs'
import type { FFTOceanLayerAuthoringConfig } from '@/scenes/water/fftOcean/types/FFTOceanLayerAuthoringConfig'

describe('createFFTOceanLayerBuildInputs', () => {
  it('把一层 JONSWAP authoring 数据准确拆成三个窄输入', () => {
    const layer = createJONSWAPLayer()

    const inputs = createFFTOceanLayerBuildInputs(layer)

    expect(inputs).toStrictEqual({
      modelConfig: {
        model: 'jonswap',
        primary: {
          scale: 0.8,
          windSpeed: 12,
          windDirection: 35,
          fetch: 100000,
          spreadBlend: 0.7,
          swell: 0.2,
          peakEnhancement: 3.3,
          shortWavesFade: 0.01
        },
        secondary: {
          scale: 0.25,
          windSpeed: 7,
          windDirection: 120,
          fetch: 250000,
          spreadBlend: 0.4,
          swell: 0.75,
          peakEnhancement: 2.5,
          shortWavesFade: 0.04
        }
      },
      preparationInput: {
        context: {
          size: 256,
          gravity: 9.81,
          depth: 80,
          kMin: 0.02,
          kMax: 12
        },
        evolutionConfig: {
          size: 256,
          fftResolution: 512,
          gravity: 9.81
        },
        initialSpectrumConfig: {
          amplitude: 0.75
        },
        runtimeConfig: {
          choppiness: [1.2, 0.8],
          foamDecayRate: 0.03,
          foamAdd: 0.12,
          foamBias: 0.18,
          foamPower: 2
        }
      },
      blendConfig: {
        layerContribute: 0.6
      }
    })
  })

  it('缺省字段保持当前兼容默认值', () => {
    const layer = createJONSWAPLayer()
    layer.evaluation = { gravity: 9.81 }
    layer.initialSpectrum = {}
    layer.runtime = { choppiness: [1, 1] }
    layer.blend = {}

    const inputs = createFFTOceanLayerBuildInputs(layer)

    expect(inputs.preparationInput.context).toStrictEqual({
      size: 256,
      gravity: 9.81,
      depth: undefined,
      kMin: undefined,
      kMax: undefined
    })
    expect(inputs.preparationInput.initialSpectrumConfig).toStrictEqual({})
    expect(inputs.preparationInput.runtimeConfig).toStrictEqual({
      choppiness: [1, 1],
      foamDecayRate: 0.05,
      foamAdd: 0.1,
      foamBias: 0.2,
      foamPower: 1.5
    })
    expect(inputs.blendConfig).toStrictEqual({})
  })

  it('把显式数值 0 当作有效配置，而不是当作缺省值', () => {
    const layer = createJONSWAPLayer()
    layer.initialSpectrum = { amplitude: 0 }
    layer.runtime = {
      choppiness: [0, 0],
      foamDecayRate: 0,
      foamAdd: 0,
      foamBias: 0,
      foamPower: 0
    }
    layer.blend = { layerContribute: 0 }

    const inputs = createFFTOceanLayerBuildInputs(layer)

    expect(inputs.preparationInput.initialSpectrumConfig).toStrictEqual({ amplitude: 0 })
    expect(inputs.preparationInput.runtimeConfig).toStrictEqual({
      choppiness: [0, 0],
      foamDecayRate: 0,
      foamAdd: 0,
      foamBias: 0,
      foamPower: 0
    })
    expect(inputs.blendConfig).toStrictEqual({ layerContribute: 0 })
  })

  it('复制所有会被 GUI 继续修改的嵌套对象和向量', () => {
    const layer = createJONSWAPLayer()

    const inputs = createFFTOceanLayerBuildInputs(layer)

    expect(inputs.modelConfig).not.toBe(layer.spectrum)
    if (inputs.modelConfig.model !== 'jonswap' || layer.spectrum.model !== 'jonswap') {
      throw new Error('测试夹具必须是 JONSWAP 配置')
    }
    expect(inputs.modelConfig.primary).not.toBe(layer.spectrum.primary)
    expect(inputs.modelConfig.secondary).not.toBe(layer.spectrum.secondary)
    expect(inputs.preparationInput.runtimeConfig.choppiness).not.toBe(layer.runtime.choppiness)

    layer.spectrum.primary.scale = 99
    layer.runtime.choppiness[0] = 99
    layer.grid.size = 99

    expect(inputs.modelConfig.primary.scale).toBe(0.8)
    expect(inputs.preparationInput.runtimeConfig.choppiness[0]).toBe(1.2)
    expect(inputs.preparationInput.context.size).toBe(256)
  })

  it('分别复制 Phillips 和 Capillary 联合成员', () => {
    const phillipsLayer = createJONSWAPLayer()
    phillipsLayer.spectrum = {
      model: 'phillips',
      windSpeed: 10,
      windDirection: { x: 3, y: 4 },
      amplitude: 0.008,
      opposingWaveDamping: 0.3
    }

    const capillaryLayer = createJONSWAPLayer()
    capillaryLayer.spectrum = {
      model: 'capillary',
      baseAmplitude: 0.001,
      cutoffWavenumber: 100,
      surfaceTension: 0.074,
      waterDensity: 1000
    }

    const phillipsInputs = createFFTOceanLayerBuildInputs(phillipsLayer)
    const capillaryInputs = createFFTOceanLayerBuildInputs(capillaryLayer)

    expect(phillipsInputs.modelConfig).toStrictEqual({
      model: 'phillips',
      windSpeed: 10,
      windDirection: { x: 3, y: 4 },
      amplitude: 0.008,
      opposingWaveDamping: 0.3
    })
    expect(capillaryInputs.modelConfig).toStrictEqual({
      model: 'capillary',
      baseAmplitude: 0.001,
      cutoffWavenumber: 100,
      surfaceTension: 0.074,
      waterDensity: 1000
    })
    expect(phillipsInputs.modelConfig).not.toBe(phillipsLayer.spectrum)
    expect(capillaryInputs.modelConfig).not.toBe(capillaryLayer.spectrum)

    if (
      phillipsInputs.modelConfig.model !== 'phillips' ||
      phillipsLayer.spectrum.model !== 'phillips'
    ) {
      throw new Error('测试夹具必须是 Phillips 配置')
    }
    expect(phillipsInputs.modelConfig.windDirection).not.toBe(phillipsLayer.spectrum.windDirection)
  })
})

function createJONSWAPLayer(): FFTOceanLayerAuthoringConfig {
  return {
    grid: {
      size: 256,
      fftResolution: 512
    },
    evaluation: {
      gravity: 9.81,
      depth: 80,
      kMin: 0.02,
      kMax: 12
    },
    spectrum: {
      model: 'jonswap',
      primary: {
        scale: 0.8,
        windSpeed: 12,
        windDirection: 35,
        fetch: 100000,
        spreadBlend: 0.7,
        swell: 0.2,
        peakEnhancement: 3.3,
        shortWavesFade: 0.01
      },
      secondary: {
        scale: 0.25,
        windSpeed: 7,
        windDirection: 120,
        fetch: 250000,
        spreadBlend: 0.4,
        swell: 0.75,
        peakEnhancement: 2.5,
        shortWavesFade: 0.04
      }
    },
    initialSpectrum: {
      amplitude: 0.75
    },
    runtime: {
      choppiness: [1.2, 0.8],
      foamDecayRate: 0.03,
      foamAdd: 0.12,
      foamBias: 0.18,
      foamPower: 2
    },
    blend: {
      layerContribute: 0.6
    }
  }
}
