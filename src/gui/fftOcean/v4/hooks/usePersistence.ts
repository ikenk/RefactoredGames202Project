/**
 * usePersistence — localStorage 持久化的封装
 *
 * 职责：
 * - 把 config 状态序列化到 localStorage（debounce 防抖）
 * - 启动时尝试 restore
 * - 暴露 snapshot/apply 给 usePresets 复用
 */

import type { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers'
import { logger } from '@/logging/Logger'
import {
  applyFFTOceanSnapshot,
  takeFFTOceanSnapshot,
  type FFTOceanSnapshot
} from '../persistenceSnapshot'

function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return (...args: TArgs) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export function usePersistence(config: FFTOceanConfig, storageKey: string, debounceMs = 300) {
  return {
    /** 启动时尝试恢复，返回是否真的恢复了 */
    restore(): boolean {
      try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return false

        const parsed: unknown = JSON.parse(raw)

        applyFFTOceanSnapshot(parsed as FFTOceanSnapshot, config)

        logger.info(`[usePersistence] restored from "${storageKey}"`)

        return true
      } catch (error) {
        console.warn('[usePersistence] restore failed:', error)

        return false
      }
    },

    /** 每次 onChange 触发；debounce 后真正写盘 */
    markDirty: debounce(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(takeFFTOceanSnapshot(config)))
      } catch (error) {
        console.warn('[usePersistence] save failed:', error)
      }
    }, debounceMs),

    /** Reset / Clear 用 */
    clear(): void {
      try {
        localStorage.removeItem(storageKey)
      } catch (error) {
        console.warn('[usePersistence] clear failed:', error)
      }
    },

    /** 给 usePresets 复用：立即拍快照，不写盘 */
    snapshot: (): FFTOceanSnapshot => takeFFTOceanSnapshot(config),

    /** 给 usePresets 复用：应用任意快照 */
    apply: (snapshot: FFTOceanSnapshot): void => applyFFTOceanSnapshot(snapshot, config)
  }
}

export type PersistenceHook = ReturnType<typeof usePersistence>
