/** Logger 实际写入的出口；生产代码使用浏览器 console，测试可注入记录器。 */
export interface LogSink {
  debug(...data: unknown[]): void
  info(...data: unknown[]): void
  warn(...data: unknown[]): void
  error(...data: unknown[]): void
}

export interface LoggerOptions {
  /** 是否发送调试日志；正式构建默认关闭。 */
  readonly debugEnabled: boolean

  /** 日志的最终写入出口。 */
  readonly sink: LogSink
}
