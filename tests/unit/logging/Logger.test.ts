import { describe, expect, it, vi } from 'vitest'

import { Logger } from '@/logging/Logger'
import type { LogSink } from '@/logging/types/Logger'

function createSink(): LogSink {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}

describe('Logger', () => {
  it('关闭 debug 时仍把 info、warn 和 error 转发给日志出口', () => {
    const sink = createSink()
    const logger = new Logger({ debugEnabled: false, sink })
    const detail = { count: 2 }

    logger.info('loaded', detail)
    logger.warn('fallback', detail)
    logger.error('failed', detail)

    expect(sink.info).toHaveBeenCalledWith('loaded', detail)
    expect(sink.warn).toHaveBeenCalledWith('fallback', detail)
    expect(sink.error).toHaveBeenCalledWith('failed', detail)
  })

  it('关闭 debug 时不向日志出口发送调试信息', () => {
    const sink = createSink()
    const logger = new Logger({ debugEnabled: false, sink })

    logger.debug('drag position', 12, 24)

    expect(sink.debug).not.toHaveBeenCalled()
  })

  it('开启 debug 时向日志出口发送调试信息', () => {
    const sink = createSink()
    const logger = new Logger({ debugEnabled: true, sink })

    logger.debug('drag position', 12, 24)

    expect(sink.debug).toHaveBeenCalledWith('drag position', 12, 24)
  })
})
