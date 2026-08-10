import type { Complex } from '@/math/Complex'
import { measureComplexSquareMatrix } from '@/math/complexMatrix'

/**
 * 计算非空 N×N 复数场的均方根：
 *
 * RMS = sqrt(Σ |zᵢⱼ|² / N²)
 *
 * @throws {RangeError} field 为空、不是 N×N 方阵或包含稀疏空槽时抛出。
 */
export function computeRMS(field: readonly (readonly Complex[])[]): number {
  const { size, sumSquaredMagnitudes } = measureComplexSquareMatrix(field, '[computeRMS] field')

  return Math.sqrt(sumSquaredMagnitudes / (size * size))
}
