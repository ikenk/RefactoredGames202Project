import type { Complex } from '@/math/Complex'
import { ComplexSquareMatrixMetrics } from './types/complexMatrix'

/**
 * 验证非空复数方阵，并在一次遍历中累计所有元素的模长平方和。
 *
 * @param field 要测量的复数矩阵。
 * @param path 用于错误信息的调用方路径，例如 `[computeRMS] field`。
 * @throws {RangeError} field 为空、不是方阵或包含稀疏空槽时抛出。
 */
export function measureComplexSquareMatrix(
  field: readonly (readonly Complex[])[],
  path: string
): ComplexSquareMatrixMetrics {
  const size = field.length

  if (size === 0) {
    throw new RangeError(`${path} must be a non-empty square matrix`)
  }

  let sumSquaredMagnitudes = 0

  for (const [rowIndex, row] of field.entries()) {
    if (row.length !== size) {
      throw new RangeError(
        `${path} row ${rowIndex} must contain ${size} values; received ${row.length}`
      )
    }

    for (const [columnIndex, value] of row.entries()) {
      if (value === undefined) {
        throw new RangeError(`${path}[${rowIndex}][${columnIndex}] is missing`)
      }

      sumSquaredMagnitudes += value.real ** 2 + value.imag ** 2
    }
  }

  return { size, sumSquaredMagnitudes }
}
