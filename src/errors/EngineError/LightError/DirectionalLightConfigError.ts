import { LightError } from './BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * 方向光配置非法
 *
 * 触发场景：
 *   - 未传 target（不允许显式传 direction，避免 visualizer / shadow / shader 三处不一致）
 *   - direction 长度接近 0（fromDirection 工厂里 normalize 会除以 0）
 *   - 其他构造参数自相矛盾的情况
 *
 * 不可恢复：调用方必须修配置后重新构造，不能在运行时自愈
 */
export class DirectionalLightConfigError extends LightError {
  constructor(reason: string, context?: ErrorContext) {
    super(`[DirectionalLight] ${reason}`, 'DIRECTIONAL_LIGHT_CONFIG', {
      context,
      recoverable: false
    })
  }
}
