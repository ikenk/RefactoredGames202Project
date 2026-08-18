import type { LoggerOptions, LogSink } from './types/Logger'

/**
 * 应用统一日志边界。
 *
 * `info`、`warn` 和 `error` 在开发与生产环境中都会输出；`debug` 只在
 * `debugEnabled` 为 true 时输出。使用本类的业务模块不再依赖具体日志出口。
 */
export class Logger {
  private readonly options: LoggerOptions

  constructor(options: LoggerOptions) {
    this.options = options
  }

  debug(...data: unknown[]): void {
    if (!this.options.debugEnabled) return

    this.options.sink.debug(...data)
  }

  info(...data: unknown[]): void {
    this.options.sink.info(...data)
  }

  warn(...data: unknown[]): void {
    this.options.sink.warn(...data)
  }

  error(...data: unknown[]): void {
    this.options.sink.error(...data)
  }
}

const browserConsoleSink: LogSink = {
  debug: (...data) => console.debug(...data),
  info: (...data) => console.info(...data),
  warn: (...data) => console.warn(...data),
  error: (...data) => console.error(...data)
}

/** 应用共享 Logger；生产构建保留 info/warn/error，删除 debug 输出。 */
export const logger = new Logger({
  debugEnabled: import.meta.env.DEV,
  sink: browserConsoleSink
})
