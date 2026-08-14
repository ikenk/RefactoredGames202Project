/**
 * 类型断言失败错误
 *
 * @example
 * ```ts
 * function processUser(data: unknown) {
 *   if (!isUser(data)) {
 *     throw new TypeAssertionError('User', data)
 *   }
 *   // ...
 * }
 * ```
 */
export class TypeAssertionError extends Error {
  constructor(expectedType: string) {
    super(`Type assertion failed: expected ${expectedType}`)

    this.name = 'TypeAssertionError'

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }
}
