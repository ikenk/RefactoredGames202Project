import { describe, expect, it } from 'vitest'
import { FFTOceanMaterial } from '@/materials/water/FFTOceanMaterial-MultiLayers'
import type { FFTOceanLayerBlendConfig } from '@/materials/water/types/FFTOceanLayerBlendConfig'

describe('FFTOceanMaterial', () => {
  it('将每层混合权重写入对应的 uLayerContribute uniform', () => {
    const layerBlendConfigs: readonly FFTOceanLayerBlendConfig[] = [{ layerContribute: 0.75 }, {}]

    const material = new FFTOceanMaterial('test-ocean', layerBlendConfigs)

    expect(material.getUniformValue('uLayerContribute0')).toBe(0.75)
    expect(material.getUniformValue('uLayerContribute1')).toBe(1)
  })

  it('只为传入的层创建 FFT 纹理与几何 uniform 占位', () => {
    const layerBlendConfigs: readonly FFTOceanLayerBlendConfig[] = [
      { layerContribute: 0.9 },
      { layerContribute: 0.4 }
    ]

    const material = new FFTOceanMaterial('test-ocean', layerBlendConfigs)

    expect(material.hasUniform('uDisplacementMap0')).toBe(true)
    expect(material.hasUniform('uGradientMap0')).toBe(true)
    expect(material.hasUniform('uDispDerivativeMap0')).toBe(true)
    expect(material.hasUniform('uLayerSize0')).toBe(true)

    expect(material.hasUniform('uDisplacementMap1')).toBe(true)
    expect(material.hasUniform('uGradientMap1')).toBe(true)
    expect(material.hasUniform('uDispDerivativeMap1')).toBe(true)
    expect(material.hasUniform('uLayerSize1')).toBe(true)

    expect(material.hasUniform('uDisplacementMap2')).toBe(false)
    expect(material.hasUniform('uLayerContribute2')).toBe(false)
    expect(material.hasUniform('uLayerSize2')).toBe(false)
  })
})
