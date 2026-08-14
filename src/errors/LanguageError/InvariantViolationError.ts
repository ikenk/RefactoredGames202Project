/**
 * 不变量违反错误
 *
 * @remarks
 * 用于运行时检查代码的不变量(invariant)
 *
 * @example
 * ```ts
 * function divide(a: number, b: number) {
 *   if (b === 0) {
 *     throw new InvariantViolationError('Divisor cannot be zero')
 *   }
 *   return a / b
 * }
 * ```
 */
export class InvariantViolationError extends Error {
  constructor(condition: string) {
    super(`Invariant violation: ${condition}`)

    this.name = 'InvariantViolationError'

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }
}
