import { describe, expect, it } from 'vitest'
import { createFFTOceanLayerBlendConfigs } from '@/materials/water/createFFTOceanLayerBlendConfigs'
import type { FFTOceanLayerBlendConfig } from '@/materials/water/types/FFTOceanLayerBlendConfig'

type BlendConfigWithUnrelatedFields = FFTOceanLayerBlendConfig & {
  readonly size: number
  readonly foamPower: number
}

describe('createFFTOceanLayerBlendConfigs', () => {
  it('按原顺序只提取每层的 layerContribute', () => {
    const layers: readonly BlendConfigWithUnrelatedFields[] = [
      {
        size: 512,
        layerContribute: 0.95,
        foamPower: 1.8
      },
      {
        size: 128,
        layerContribute: 0.35,
        foamPower: 0.7
      }
    ]

    const result = createFFTOceanLayerBlendConfigs(layers)

    expect(result).toEqual([{ layerContribute: 0.95 }, { layerContribute: 0.35 }])
    expect(result[0]).not.toBe(layers[0])
    expect(result[1]).not.toBe(layers[1])
  })

  it('缺少 layerContribute 时输出空配置，由 Material 负责应用默认值', () => {
    const result = createFFTOceanLayerBlendConfigs([{}, { layerContribute: 0 }])

    expect(result).toEqual([{}, { layerContribute: 0 }])
  })
})
