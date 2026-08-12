import type { FFTGridAuthoringConfig } from '@/scenes/water/fftOcean/types/FFTOceanLayerAuthoringConfig'
import type { FFTGridConfig } from './types/FFTGridConfig'

/**
 * 校验并复制场景可编辑的 FFT 网格配置。
 *
 * 返回冻结的新对象，使已经开始运行的 FFT 层不会继续引用 GUI 正在修改的对象。
 */
export function resolveFFTGridConfig(config: FFTGridAuthoringConfig): FFTGridConfig {
  const size = requirePositiveFiniteSize(config.size)
  const fftResolution = requirePowerOfTwoResolution(config.fftResolution)

  return Object.freeze({ size, fftResolution })
}

function requirePositiveFiniteSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new RangeError(
      `[FFTGridConfig] size must be a finite number greater than 0; received ${size}`
    )
  }

  return size
}

function requirePowerOfTwoResolution(fftResolution: number): number {
  const isPositiveInteger = Number.isInteger(fftResolution) && fftResolution > 0
  const isPowerOfTwo = isPositiveInteger && Number.isInteger(Math.log2(fftResolution))

  if (!isPowerOfTwo) {
    throw new RangeError(
      '[FFTGridConfig] fftResolution must be a positive integer power of 2; ' +
        `received ${fftResolution}`
    )
  }

  return fftResolution
}
