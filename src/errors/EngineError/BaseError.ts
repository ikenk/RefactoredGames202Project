import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * 所有自定义错误的基类
 *
 * @remarks
 * - 用于统一错误结构（code / context / recoverable / cause）
 * - 适合日志、监控、错误上报系统使用
 * - 推荐所有业务错误继承该类
 *
 *
 * @param {string} message - 错误描述信息（开发者可读）
 * @param {string} code - 错误代码，用于国际化、错误分类或错误码映射
 * @param {Date} timestamp - 错误发生的时间戳
 * @param options - 额外选项
 * @param {Record<string, any>} options.context - 错误上下文信息，用于调试、日志或错误上报
 * @param {boolean} options.recoverable - 是否为可恢复错误
 * @remarks
 * - `true` 表示可以通过重试、降级等方式恢复
 * - `false` 表示致命错误
 * @param {Error} options.cause - 原始错误（Error Cause），用于错误链追踪
 * @remarks
 * - 用于包装底层异常
 * - 等价于 ES2022 的 `new Error(message, { cause })`
 *
 *
 * @example
 * ```ts
 * class NetworkError extends EngineError {
 *   constructor(url: string, cause?: Error) {
 *     super('WebGL is not supported in this browser', 'WEBGL_NOT_SUPPORTED', {
 *       recoverable: false,
 *       cause
 *     })
 *   }
 * }
 * ```
 */
export abstract class EngineError extends Error {
  // 错误代码（用于国际化、错误码映射等）
  public readonly code: string

  // 时间戳
  public readonly timestamp: Date

  // 错误上下文（附加信息）
  public readonly context?: ErrorContext

  // 是否可恢复
  public readonly recoverable: boolean

  // 原始错误（Error Cause），用于错误链追踪
  public override readonly cause?: Error

  constructor(
    message: string,
    code: string,
    options: {
      context?: ErrorContext
      recoverable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message)

    // 设置原型链（TypeScript/ES6 特殊处理）
    Object.setPrototypeOf(this, new.target.prototype)

    this.name = this.constructor.name
    this.code = code
    this.context = options.context
    this.recoverable = options.recoverable ?? false
    this.timestamp = new Date()

    // 保存原始错误（Error Cause）
    if (options.cause) {
      this.cause = options.cause
    }

    // 捕获堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }

  /**
   * 转换为JSON（用于日志和监控）
   *
   * @remarks
   * 适用于日志系统、监控平台或错误上报服务。
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    }
  }

  /**
   * 转换为用户友好的消息
   *
   * @remarks
   * - 子类可重写该方法以支持国际化或更友好的提示
   * - 默认返回 `message`
   */
  toUserMessage(): string {
    return this.message
  }
}
