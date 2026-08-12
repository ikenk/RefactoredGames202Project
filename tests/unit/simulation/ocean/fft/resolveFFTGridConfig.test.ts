import { describe, expect, it } from 'vitest'

import { resolveFFTGridConfig } from '@/simulation/ocean/fft/resolveFFTGridConfig'

describe('resolveFFTGridConfig', () => {
  it('校验后返回与可编辑配置解除引用的冻结快照', () => {
    const authoringConfig = {
      size: 64,
      fftResolution: 256
    }

    const gridConfig = resolveFFTGridConfig(authoringConfig)

    expect(gridConfig).toEqual({
      size: 64,
      fftResolution: 256
    })
    expect(gridConfig).not.toBe(authoringConfig)
    expect(Object.isFrozen(gridConfig)).toBe(true)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('拒绝无效的物理边长 %s', (size) => {
    expect(() =>
      resolveFFTGridConfig({
        size,
        fftResolution: 256
      })
    ).toThrow(RangeError)
  })

  it.each([0, -2, 3, 256.5, Number.NaN, Number.POSITIVE_INFINITY])(
    '拒绝无效的 FFT 分辨率 %s',
    (fftResolution) => {
      expect(() =>
        resolveFFTGridConfig({
          size: 64,
          fftResolution
        })
      ).toThrow(RangeError)
    }
  )
})
