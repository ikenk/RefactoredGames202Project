import { describe, expect, it } from 'vitest'
import { Complex } from '@/math/Complex'
import { computeRMS } from '@/math/computeRMS'

function complex(real: number, imag: number): Complex {
  return new Complex(real, imag)
}

describe('computeRMS', () => {
  it('计算非空方阵中复数模长的均方根', () => {
    const field = [
      [complex(3, 4), complex(0, 0)],
      [complex(0, 0), complex(0, 0)]
    ]

    expect(computeRMS(field)).toBeCloseTo(2.5, 10)
  })

  it('拒绝空矩阵', () => {
    expect(() => computeRMS([])).toThrowError(
      '[computeRMS] field must be a non-empty square matrix'
    )
  })

  it('拒绝行长度与矩阵阶数不一致的矩阵', () => {
    const field = [[complex(1, 0)], [complex(2, 0), complex(3, 0)]]

    expect(() => computeRMS(field)).toThrowError(
      '[computeRMS] field row 0 must contain 2 values; received 1'
    )
  })

  it('拒绝长度正确但存在空槽的稀疏矩阵', () => {
    const sparseRow = new Array<Complex>(2)
    const field = [sparseRow, [complex(1, 0), complex(2, 0)]]

    expect(() => computeRMS(field)).toThrowError('[computeRMS] field[0][0] is missing')
  })
})
