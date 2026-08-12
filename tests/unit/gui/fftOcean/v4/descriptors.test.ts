import { describe, expect, it } from 'vitest'

import { buildLayerDescriptors } from '@/gui/fftOcean/v4/descriptors'
import type { SpectrumModelConfig } from '@/simulation/ocean/spectrums/types/SpectrumModelConfig'

type SpectrumModel = SpectrumModelConfig['model']

interface DescriptorView {
  readonly tier: string
  readonly key?: string
  readonly targetGroup?: string
  readonly scope?: string
}

const buildDescriptors = buildLayerDescriptors as unknown as (
  layerIndex: number,
  model: SpectrumModel
) => DescriptorView[]

describe('buildLayerDescriptors', () => {
  it('把通用 layer 控件路由到新的嵌套 authoring 分组', () => {
    const descriptors = buildDescriptors(2, 'jonswap')

    expect(findDescriptor(descriptors, 'T2-contribute')).toMatchObject({
      targetGroup: 'blend'
    })
    expect(findDescriptor(descriptors, 'T2-choppiness')).toMatchObject({
      targetGroup: 'runtime'
    })
    expect(findDescriptor(descriptors, 'T2-foam', 'foamBias')).toMatchObject({
      targetGroup: 'runtime'
    })
    expect(findDescriptor(descriptors, 'T3-spectrum', 'amplitude')).toMatchObject({
      targetGroup: 'initialSpectrum'
    })
    expect(findDescriptor(descriptors, 'T3-spectrum', 'kMin')).toMatchObject({
      targetGroup: 'evaluation'
    })
    expect(findDescriptor(descriptors, 'T3-spectrum', 'kMax')).toMatchObject({
      targetGroup: 'evaluation'
    })
  })

  it('只有 JONSWAP 层生成 primary 和 secondary 模型控件', () => {
    const jonswapDescriptors = buildDescriptors(0, 'jonswap')
    const phillipsDescriptors = buildDescriptors(0, 'phillips')
    const capillaryDescriptors = buildDescriptors(0, 'capillary')

    expect(
      jonswapDescriptors.filter(({ targetGroup }) => targetGroup === 'spectrum-primary')
    ).toHaveLength(8)
    expect(
      jonswapDescriptors.filter(({ targetGroup }) => targetGroup === 'spectrum-secondary')
    ).toHaveLength(8)

    for (const descriptors of [phillipsDescriptors, capillaryDescriptors]) {
      expect(
        descriptors.some(
          ({ targetGroup, scope }) =>
            targetGroup === 'spectrum-primary' ||
            targetGroup === 'spectrum-secondary' ||
            scope === 'spectrum0' ||
            scope === 'spectrum1'
        )
      ).toBe(false)
    }
  })
})

function findDescriptor(
  descriptors: DescriptorView[],
  tier: string,
  key?: string
): DescriptorView | undefined {
  return descriptors.find(
    (descriptor) => descriptor.tier === tier && (key === undefined || descriptor.key === key)
  )
}
