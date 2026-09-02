import { describe, expect, it, vi } from 'vitest'

import { WebGLResourceCreationError } from '@/rendering/core/errors'
import { requireNonNull } from '@/rendering/core/requireNonNull'

/**
 * 编译期负向契约：第二个参数必须是惰性的 `() => Error`，不能直接传错误字符串。
 *
 * @remarks
 * Vitest 不执行此函数；`tsc` 会检查函数体，并在这条调用不再产生类型错误时报告
 * “Unused @ts-expect-error”，从而捕获 API 被错误放宽为 `string`、`unknown` 或 `any`。
 */
function typeCheckErrorFactory(): void {
  // @ts-expect-error errorFactory 必须是 () => Error，不能传普通字符串
  requireNonNull(null, 'failed to create resource')
}

// 保留函数引用但不在运行时调用；这里的契约由 TypeScript 编译器验证。
void typeCheckErrorFactory

describe('requireNonNull', () => {
  /**
   * 保护的错误实现：成功路径复制、包装或替换了调用者创建的 WebGL handle。
   */
  it('原样返回非 null 对象并保留对象身份', () => {
    const value = {
      handle: 'buffer'
    }

    const result = requireNonNull(value, () => new Error('unused'))

    expect(result).toBe(value)
  })

  /**
   * 保护的错误实现：使用 `if (!value)`，把合法 falsy 值误判为创建失败。
   */
  it('不把 0、false 和空字符串误判为 null', () => {
    const errorFactory = vi.fn(() => new Error('unused'))

    expect(requireNonNull(0, errorFactory)).toBe(0)
    expect(requireNonNull(false, errorFactory)).toBe(false)
    expect(requireNonNull('', errorFactory)).toBe('')
    expect(errorFactory).not.toHaveBeenCalled()
  })

  /**
   * 保护的错误实现：提前执行 errorFactory，导致成功路径也创建昂贵错误及堆栈。
   */
  it('成功路径不调用惰性的 error factory', () => {
    const errorFactory = vi.fn(() => new Error('unused'))

    const result = requireNonNull('created', errorFactory)

    expect(result).toBe('created')
    expect(errorFactory).not.toHaveBeenCalled()
  })

  /**
   * 保护的错误实现：null 分支未调用 factory、调用多次，或没有抛出返回的错误。
   */
  it('只有 value === null 时调用 error factory 恰好一次', () => {
    const error = new WebGLResourceCreationError('buffer', 'particle-position')
    const errorFactory = vi.fn(() => error)

    expect(() => requireNonNull(null, errorFactory)).toThrow(error)
    expect(errorFactory).toHaveBeenCalledTimes(1)
  })

  /**
   * 保护的错误实现：用新的裸 Error 包装领域错误，丢失具体类型、code 和 details。
   */
  it('抛出 error factory 返回的同一个领域错误实例', () => {
    const expectedError = new WebGLResourceCreationError('texture', 'skybox')

    try {
      requireNonNull(null, () => expectedError)
      throw new Error('requireNonNull did not throw')
    } catch (error) {
      expect(error).toBe(expectedError)
    }
  })
})
