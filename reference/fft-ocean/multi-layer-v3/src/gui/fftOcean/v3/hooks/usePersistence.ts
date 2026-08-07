/**
 * usePersistence — localStorage 持久化的封装
 *
 * 职责：
 * - 把 config 状态序列化到 localStorage（debounce 防抖）
 * - 启动时尝试 restore
 * - 暴露 snapshot/apply 给 usePresets 复用
 */

import type { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers'
import type { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'

export interface Snapshot {
  materialConfig: Record<string, unknown>
  oceanParamsCascade: Record<string, unknown>[]
}

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

function takeSnapshot(config: FFTOceanConfig): Snapshot {
  return {
    materialConfig: { ...(config.materialConfig as Record<string, unknown>) },
    oceanParamsCascade: config.oceanParamsCascade.map(
      (l): Record<string, unknown> => ({
        amplitude: l.amplitude,
        layerContribute: l.layerContribute,
        choppiness: l.choppiness ? [...l.choppiness] : undefined,
        kMin: l.kMin,
        kMax: l.kMax,
        foamBias: l.foamBias,
        foamAdd: l.foamAdd,
        foamDecayRate: l.foamDecayRate,
        foamPower: l.foamPower,
        spectrum0: l.spectrum0 ? { ...l.spectrum0 } : undefined,
        spectrum1: l.spectrum1 ? { ...l.spectrum1 } : undefined
      })
    )
  }
}

function applySnapshot(snap: Snapshot, config: FFTOceanConfig): void {
  Object.assign(config.materialConfig, snap.materialConfig)
  snap.oceanParamsCascade.forEach((override, i) => {
    const layer = config.oceanParamsCascade[i] as OceanParams | undefined
    if (!layer) return
    const layerRec = layer as unknown as Record<string, unknown>
    Object.keys(override).forEach((k) => {
      if (k === 'spectrum0' || k === 'spectrum1') return
      const v = override[k]
      if (v !== undefined) layerRec[k] = v
    })
    const o0 = override.spectrum0 as Record<string, unknown> | undefined
    const o1 = override.spectrum1 as Record<string, unknown> | undefined
    if (o0 && layer.spectrum0) Object.assign(layer.spectrum0, o0)
    if (o1 && layer.spectrum1) Object.assign(layer.spectrum1, o1)
  })
}

export function usePersistence(config: FFTOceanConfig, storageKey: string, debounceMs = 300) {
  return {
    /** 启动时尝试恢复，返回是否真的恢复了 */
    restore(): boolean {
      try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return false
        // JSON.parse 在 TS lib 中固定返回 any，是无法消除的类型擦除点。
        // 此处显式断言为 Snapshot，并承担 saved 数据结构正确的责任。
        // 若需运行时校验，可在此引入 zod / valibot。
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed: Snapshot = JSON.parse(raw)
        applySnapshot(parsed, config)
        console.info(`[usePersistence] restored from "${storageKey}"`)
        return true
      } catch (e) {
        console.warn('[usePersistence] restore failed:', e)
        return false
      }
    },

    /** 每次 onChange 触发；debounce 后真正写盘 */
    markDirty: debounce(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(takeSnapshot(config)))
      } catch (e) {
        console.warn('[usePersistence] save failed:', e)
      }
    }, debounceMs),

    /** Reset / Clear 用 */
    clear(): void {
      try {
        localStorage.removeItem(storageKey)
      } catch (e) {
        console.warn('[usePersistence] clear failed:', e)
      }
    },

    /** 给 usePresets 复用：立即拍快照（不写盘） */
    snapshot: (): Snapshot => takeSnapshot(config),

    /** 给 usePresets 复用：应用任意快照 */
    apply: (snap: Snapshot): void => applySnapshot(snap, config)
  }
}

export type PersistenceHook = ReturnType<typeof usePersistence>
