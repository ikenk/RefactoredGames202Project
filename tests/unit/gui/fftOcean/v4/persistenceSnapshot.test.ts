import { describe, expect, it } from 'vitest'

import { applyFFTOceanSnapshot, takeFFTOceanSnapshot } from '@/gui/fftOcean/v4/persistenceSnapshot'
import { Transform } from '@/objects/utils/Transform'
import type { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers'

describe('FFT Ocean GUI persistence snapshot', () => {
  it('拍摄快照时深复制所有仍会被 GUI 修改的 layer 数据', () => {
    const config = createConfig()

    const snapshot = takeFFTOceanSnapshot(config)

    const sourceLayer = config.layers[0]!
    const savedLayer = snapshot.layers[0]!

    expect(snapshot.materialConfig).not.toBe(config.materialConfig)
    expect(savedLayer).not.toBe(sourceLayer)
    expect(savedLayer.grid).not.toBe(sourceLayer.grid)
    expect(savedLayer.evaluation).not.toBe(sourceLayer.evaluation)
    expect(savedLayer.initialSpectrum).not.toBe(sourceLayer.initialSpectrum)
    expect(savedLayer.runtime).not.toBe(sourceLayer.runtime)
    expect(savedLayer.runtime.choppiness).not.toBe(sourceLayer.runtime.choppiness)
    expect(savedLayer.blend).not.toBe(sourceLayer.blend)

    if (savedLayer.spectrum.model !== 'jonswap' || sourceLayer.spectrum.model !== 'jonswap') {
      throw new Error('测试夹具必须是 JONSWAP 配置')
    }
    expect(savedLayer.spectrum).not.toBe(sourceLayer.spectrum)
    expect(savedLayer.spectrum.primary).not.toBe(sourceLayer.spectrum.primary)
    expect(savedLayer.spectrum.secondary).not.toBe(sourceLayer.spectrum.secondary)

    sourceLayer.runtime.choppiness[0] = 99
    sourceLayer.spectrum.primary.scale = 99
    sourceLayer.blend.layerContribute = 99

    expect(savedLayer.runtime.choppiness[0]).toBe(1.2)
    expect(savedLayer.spectrum.primary.scale).toBe(0.8)
    expect(savedLayer.blend.layerContribute).toBe(0.6)
  })

  it('拍摄材质配置快照时复制所有元组字段', () => {
    const config = createConfig()
    config.materialConfig.ambientColor = [0.1, 0.2, 0.3]
    config.materialConfig.depthCenter = [10, 20]
    config.materialConfig.scatterColor = [0.3, 0.4, 0.5]
    config.materialConfig.scatterPeakColor = [0.6, 0.7, 0.8]
    config.materialConfig.foamColor = [0.9, 0.8, 0.7]
    config.materialConfig.fogColor = [0.2, 0.3, 0.4]

    const snapshot = takeFFTOceanSnapshot(config)
    const tupleFields = [
      'ambientColor',
      'depthCenter',
      'scatterColor',
      'scatterPeakColor',
      'foamColor',
      'fogColor'
    ] as const

    for (const field of tupleFields) {
      expect(snapshot.materialConfig[field]).toStrictEqual(config.materialConfig[field])
      expect(snapshot.materialConfig[field]).not.toBe(config.materialConfig[field])
    }
  })

  it('应用快照时保留 Tweakpane 已绑定对象的身份并写入显式 0', () => {
    const config = createConfig()
    const layer = config.layers[0]!
    const references = {
      layer,
      grid: layer.grid,
      evaluation: layer.evaluation,
      initialSpectrum: layer.initialSpectrum,
      runtime: layer.runtime,
      choppiness: layer.runtime.choppiness,
      blend: layer.blend,
      spectrum: layer.spectrum
    }

    if (layer.spectrum.model !== 'jonswap') {
      throw new Error('测试夹具必须是 JONSWAP 配置')
    }
    const primary = layer.spectrum.primary
    const secondary = layer.spectrum.secondary

    const source = createConfig()
    const sourceLayer = source.layers[0]!
    source.materialConfig.roughness = 0
    sourceLayer.grid.size = 64
    sourceLayer.evaluation.kMin = 0
    sourceLayer.initialSpectrum.amplitude = 0
    sourceLayer.runtime.choppiness = [0, 0]
    sourceLayer.runtime.foamAdd = 0
    sourceLayer.blend.layerContribute = 0
    if (sourceLayer.spectrum.model !== 'jonswap') {
      throw new Error('测试夹具必须是 JONSWAP 配置')
    }
    sourceLayer.spectrum.primary.scale = 0
    sourceLayer.spectrum.secondary!.scale = 0

    applyFFTOceanSnapshot(takeFFTOceanSnapshot(source), config)

    expect(config.layers[0]).toBe(references.layer)
    expect(layer.grid).toBe(references.grid)
    expect(layer.evaluation).toBe(references.evaluation)
    expect(layer.initialSpectrum).toBe(references.initialSpectrum)
    expect(layer.runtime).toBe(references.runtime)
    expect(layer.runtime.choppiness).toBe(references.choppiness)
    expect(layer.blend).toBe(references.blend)
    expect(layer.spectrum).toBe(references.spectrum)

    if (layer.spectrum.model !== 'jonswap') {
      throw new Error('应用快照后仍应是 JONSWAP 配置')
    }
    expect(layer.spectrum.primary).toBe(primary)
    expect(layer.spectrum.secondary).toBe(secondary)

    expect(config.materialConfig.roughness).toBe(0)
    expect(layer.grid.size).toBe(64)
    expect(layer.evaluation.kMin).toBe(0)
    expect(layer.initialSpectrum.amplitude).toBe(0)
    expect(layer.runtime.choppiness).toStrictEqual([0, 0])
    expect(layer.runtime.foamAdd).toBe(0)
    expect(layer.blend.layerContribute).toBe(0)
    expect(layer.spectrum.primary.scale).toBe(0)
    expect(layer.spectrum.secondary?.scale).toBe(0)
  })
})

function createConfig(): FFTOceanConfig {
  return {
    transform: new Transform(),
    surfaceSize: 256,
    surfaceMeshResolution: 512,
    materialConfig: {
      roughness: 0.05
    },
    renderingMode: 'MESH',
    layers: [
      {
        grid: {
          size: 256,
          fftResolution: 512
        },
        evaluation: {
          gravity: 9.81,
          depth: 100,
          kMin: 0.02,
          kMax: 10
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
    ]
  }
}
