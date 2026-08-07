import { describe, expect, it } from 'vitest'
import { createFFTOceanLayerBlendConfigs } from '@/materials/water/createFFTOceanLayerBlendConfigs'
import type { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'

function createOceanParams(overrides: Partial<OceanParams> = {}): OceanParams {
  return {
    size: 64,
    fftResolution: 2,
    gravity: 9.81,
    choppiness: [1, 1],
    ...overrides
  }
}

describe('createFFTOceanLayerBlendConfigs', () => {
  it('按原顺序只提取每层的 layerContribute', () => {
    const oceanParamsCascade: readonly OceanParams[] = [
      createOceanParams({
        size: 512,
        layerContribute: 0.95,
        foamPower: 1.8
      }),
      createOceanParams({
        size: 128,
        layerContribute: 0.35,
        foamPower: 0.7
      })
    ]

    const result = createFFTOceanLayerBlendConfigs(oceanParamsCascade)

    expect(result).toEqual([{ layerContribute: 0.95 }, { layerContribute: 0.35 }])
    expect(result[0]).not.toBe(oceanParamsCascade[0])
    expect(result[1]).not.toBe(oceanParamsCascade[1])
  })

  it('缺少 layerContribute 时输出空配置，由 Material 负责应用默认值', () => {
    const result = createFFTOceanLayerBlendConfigs([
      createOceanParams(),
      createOceanParams({ layerContribute: 0 })
    ])

    expect(result).toEqual([{}, { layerContribute: 0 }])
  })
})
