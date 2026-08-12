import { describe, expect, it } from 'vitest'

import { createFFTOceanLayerBuildInputs } from '@/scenes/water/fftOcean/createFFTOceanLayerBuildInputs'
import { DEFAULT_FFT_OCEAN_CONFIG } from '@/scenes/water/fftOcean/_config/fftOceanSceneConfig-MultiLayers'
import type { FFTOceanLayerAuthoringConfig } from '@/scenes/water/fftOcean/types/FFTOceanLayerAuthoringConfig'

interface LayerAuthoringConfigView {
  readonly layers: FFTOceanLayerAuthoringConfig[]
}

describe('DEFAULT_FFT_OCEAN_CONFIG layer authoring contract', () => {
  it('四个默认 cascade 都能转换为有效的 JONSWAP 构建输入', () => {
    const config = DEFAULT_FFT_OCEAN_CONFIG as unknown as LayerAuthoringConfigView

    const buildInputs = config.layers.map(createFFTOceanLayerBuildInputs)

    expect(buildInputs).toHaveLength(4)
    expect(buildInputs.map(({ modelConfig }) => modelConfig.model)).toStrictEqual([
      'jonswap',
      'jonswap',
      'jonswap',
      'jonswap'
    ])
    expect(
      buildInputs.map(({ preparationInput }) => preparationInput.evolutionConfig.size)
    ).toStrictEqual([256, 64, 16, 4])
    expect(buildInputs.map(({ blendConfig }) => blendConfig.layerContribute)).toStrictEqual([
      0.95, 0.75, 0.6, 0.35
    ])
  })
})
