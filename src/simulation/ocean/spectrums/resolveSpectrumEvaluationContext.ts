import type { SpectrumEvaluationContext } from './types/SpectrumEvaluationContext'

/**
 * 校验并复制一层波谱求值环境。
 *
 * 返回新对象，避免 Spectrum 求值阶段继续依赖场景和 GUI 持有的可变配置。
 */
export function resolveSpectrumEvaluationContext(
  context: SpectrumEvaluationContext
): Readonly<SpectrumEvaluationContext> {
  const size = requirePositive(context.size, 'size')
  const gravity = requirePositive(context.gravity, 'gravity')
  const depth = resolveOptionalPositive(context.depth, 'depth')
  const kMin = resolveOptionalNonNegative(context.kMin, 'kMin')
  const kMax = resolveOptionalPositive(context.kMax, 'kMax')

  if (kMin !== undefined && kMax !== undefined && kMin >= kMax) {
    throw new RangeError(
      `[SpectrumEvaluationContext] kMin must be less than kMax; received ${kMin} >= ${kMax}`
    )
  }

  return Object.freeze({ size, gravity, depth, kMin, kMax })
}

function resolveOptionalPositive(value: number | undefined, path: string): number | undefined {
  return value === undefined ? undefined : requirePositive(value, path)
}

function resolveOptionalNonNegative(value: number | undefined, path: string): number | undefined {
  return value === undefined ? undefined : requireNonNegative(value, path)
}

function requireFinite(value: number, path: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `[SpectrumEvaluationContext] ${path} must be a finite number; received ${value}`
    )
  }
  return value
}

function requirePositive(value: number, path: string): number {
  const finiteValue = requireFinite(value, path)
  if (finiteValue <= 0) {
    throw new RangeError(
      `[SpectrumEvaluationContext] ${path} must be greater than 0; received ${value}`
    )
  }
  return finiteValue
}

function requireNonNegative(value: number, path: string): number {
  const finiteValue = requireFinite(value, path)
  if (finiteValue < 0) {
    throw new RangeError(
      `[SpectrumEvaluationContext] ${path} must be at least 0; received ${value}`
    )
  }
  return finiteValue
}
