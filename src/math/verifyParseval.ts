import type { Complex } from '@/math/Complex'
import { measureComplexSquareMatrix } from '@/math/complexMatrix'
import { ParsevalVerificationResult } from './types/verifyParseval'

const RELATIVE_ERROR_TOLERANCE = 1e-12

/**
 * 验证二维未归一化 DFT 使用的 Parseval 等式：
 *
 * Σ|x|² = (1 / N²) Σ|X|²
 *
 * `ratio` 是频域 RMS 与空间域 RMS 的比值；满足等式时约等于 1。
 * 两个输入都为零能量场时，将 `ratio` 定义为 1。
 *
 * @throws {RangeError} 输入为空、不是同阶方阵或包含稀疏空槽时抛出。
 */
export function verifyParseval(
  spatial: readonly (readonly Complex[])[],
  spectrum: readonly (readonly Complex[])[]
): ParsevalVerificationResult {
  const spatialMetrics = measureComplexSquareMatrix(spatial, '[verifyParseval] spatial')
  const spectrumMetrics = measureComplexSquareMatrix(spectrum, '[verifyParseval] spectrum')

  if (spectrumMetrics.size !== spatialMetrics.size) {
    throw new RangeError(
      `[verifyParseval] spectrum size must match spatial size ${spatialMetrics.size}; received ${spectrumMetrics.size}`
    )
  }

  const spatialEnergy = spatialMetrics.sumSquaredMagnitudes
  const spectrumEnergy = spectrumMetrics.sumSquaredMagnitudes
  const normalizedSpectrumEnergy = spectrumEnergy / (spatialMetrics.size * spatialMetrics.size)

  if (spatialEnergy === 0) {
    return normalizedSpectrumEnergy === 0
      ? { ok: true, ratio: 1 }
      : { ok: false, ratio: Number.POSITIVE_INFINITY }
  }

  const relativeError = Math.abs(spatialEnergy - normalizedSpectrumEnergy) / spatialEnergy

  return {
    ok: relativeError < RELATIVE_ERROR_TOLERANCE,
    ratio: Math.sqrt(normalizedSpectrumEnergy / spatialEnergy)
  }
}
