/**
 * usePresets v4 — Save / Clear / Reset-to-Factory 三个 admin 操作的 UI 封装
 *
 * 与 v3（dat.GUI）的区别：
 * - 用 Tweakpane 的 `addButton({ title }).on('click', cb)` 代替
 *   `folder.add({ fn }, 'fn').name('label')`
 */

import type { Pane, FolderApi } from 'tweakpane'
import type { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers'
import { logger } from '@/logging/Logger'
import type { PersistenceHook } from './usePersistence'

type Container = Pane | FolderApi

export function usePresets(
  _config: FFTOceanConfig,
  persistence: PersistenceHook,
  onApply: () => void
) {
  const FACTORY = persistence.snapshot()

  return {
    attachUI(container: Container): void {
      const folder = container.addFolder({ title: '💾 Presets', expanded: false })

      folder.addButton({ title: '💾 Save now' }).on('click', () => {
        persistence.markDirty()
        logger.info('[usePresets v4] saved current settings')
      })

      folder.addButton({ title: '🗑 Clear saved' }).on('click', () => {
        persistence.clear()
        logger.info('[usePresets v4] cleared localStorage (refresh to take effect)')
      })

      folder.addButton({ title: '♻️ Reset to factory' }).on('click', () => {
        persistence.apply(FACTORY)
        persistence.clear()
        onApply()
        logger.info('[usePresets v4] reset to factory defaults')
      })
    }
  }
}
