import { describe, expect, it } from 'vitest'

import { usePersistence } from '@/gui/fftOcean/v4/hooks/usePersistence'
import { DEFAULT_FFT_OCEAN_CONFIG } from '@/scenes/water/fftOcean/_config/fftOceanSceneConfig-MultiLayers'

describe('usePersistence', () => {
  it('snapshot 读取新 layers 结构且不再依赖旧 oceanParamsCascade', () => {
    const persistence = usePersistence(DEFAULT_FFT_OCEAN_CONFIG, 'unused-in-snapshot-test')

    const snapshot = persistence.snapshot()

    expect(snapshot.layers).toHaveLength(4)
    expect(snapshot.layers.map((layer) => layer.grid.size)).toStrictEqual([256, 64, 16, 4])
    expect(snapshot.layers[0]).not.toBe(DEFAULT_FFT_OCEAN_CONFIG.layers[0])
    expect('oceanParamsCascade' in snapshot).toBe(false)
  })
})
