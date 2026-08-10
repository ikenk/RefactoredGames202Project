import { describe, expect, it } from 'vitest'
import { Complex } from '@/math/Complex'
import { verifyParseval } from '@/math/verifyParseval'

function complex(real: number, imag: number = 0): Complex {
  return new Complex(real, imag)
}

describe('verifyParseval', () => {
  it('接受满足二维未归一化 DFT Parseval 等式的复数场', () => {
    const spatial = [
      [complex(1), complex(0)],
      [complex(0), complex(0)]
    ]
    const spectrum = [
      [complex(1), complex(1)],
      [complex(1), complex(1)]
    ]

    expect(verifyParseval(spatial, spectrum)).toEqual({ ok: true, ratio: 1 })
  })

  it('报告不满足 Parseval 等式的能量比例', () => {
    const spatial = [
      [complex(1), complex(0)],
      [complex(0), complex(0)]
    ]
    const spectrum = [
      [complex(0), complex(0)],
      [complex(0), complex(0)]
    ]

    expect(verifyParseval(spatial, spectrum)).toEqual({ ok: false, ratio: 0 })
  })

  it('把两个零能量复数场视为满足 Parseval 等式', () => {
    const zeroField = [
      [complex(0), complex(0)],
      [complex(0), complex(0)]
    ]

    expect(verifyParseval(zeroField, zeroField)).toEqual({ ok: true, ratio: 1 })
  })

  it('把零空间域与非零频域报告为无限能量比例', () => {
    const spatial = [
      [complex(0), complex(0)],
      [complex(0), complex(0)]
    ]
    const spectrum = [
      [complex(1), complex(1)],
      [complex(1), complex(1)]
    ]

    expect(verifyParseval(spatial, spectrum)).toEqual({
      ok: false,
      ratio: Number.POSITIVE_INFINITY
    })
  })

  it('拒绝空的空间域矩阵', () => {
    expect(() => verifyParseval([], [])).toThrowError(
      '[verifyParseval] spatial must be a non-empty square matrix'
    )
  })

  it('拒绝阶数与空间域不一致的频域矩阵', () => {
    const spatial = [
      [complex(1), complex(0)],
      [complex(0), complex(0)]
    ]
    const spectrum = [[complex(1)]]

    expect(() => verifyParseval(spatial, spectrum)).toThrowError(
      '[verifyParseval] spectrum size must match spatial size 2; received 1'
    )
  })

  it('拒绝包含空槽的频域矩阵', () => {
    const spatial = [
      [complex(1), complex(0)],
      [complex(0), complex(0)]
    ]
    const sparseRow = new Array<Complex>(2)
    const spectrum = [sparseRow, [complex(1), complex(1)]]

    expect(() => verifyParseval(spatial, spectrum)).toThrowError(
      '[verifyParseval] spectrum[0][0] is missing'
    )
  })
})
