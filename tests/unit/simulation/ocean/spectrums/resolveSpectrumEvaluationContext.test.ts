import { describe, expect, it } from 'vitest'
import { resolveSpectrumEvaluationContext } from '@/simulation/ocean/spectrums/resolveSpectrumEvaluationContext'

describe('resolveSpectrumEvaluationContext', () => {
  it('复制并冻结合法的求值环境', () => {
    const source = {
      size: 256,
      gravity: 9.81,
      depth: 40,
      kMin: 0.01,
      kMax: 20
    }

    const context = resolveSpectrumEvaluationContext(source)

    expect(context).not.toBe(source)
    expect(context).toEqual(source)
    expect(Object.isFrozen(context)).toBe(true)
  })

  it('拒绝非正数重力加速度', () => {
    expect(() =>
      resolveSpectrumEvaluationContext({
        size: 256,
        gravity: 0
      })
    ).toThrow('[SpectrumEvaluationContext] gravity must be greater than 0')
  })

  it('拒绝相反的波数截断范围', () => {
    expect(() =>
      resolveSpectrumEvaluationContext({
        size: 256,
        gravity: 9.81,
        kMin: 2,
        kMax: 1
      })
    ).toThrow('[SpectrumEvaluationContext] kMin must be less than kMax')
  })
})
