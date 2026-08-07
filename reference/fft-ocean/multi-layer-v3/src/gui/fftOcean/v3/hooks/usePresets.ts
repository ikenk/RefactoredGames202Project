import { GUI } from 'dat.gui'
import type { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers'
import type { PersistenceHook } from './usePersistence'

export function usePresets(
  _config: FFTOceanConfig, // 参数前缀 _ 表示有意未使用，避免 noUnusedParameters 警告
  persistence: PersistenceHook,
  onApply: () => void
) {
  const FACTORY = persistence.snapshot()

  return {
    attachUI(gui: GUI): void {
      const folder = gui.addFolder('💾 Presets')
      folder
        .add(
          {
            save: () => {
              persistence.markDirty()
              console.info('[usePresets] saved')
            }
          },
          'save'
        )
        .name('💾 Save now')
      folder
        .add(
          {
            clear: () => {
              persistence.clear()
              console.info('[usePresets] cleared')
            }
          },
          'clear'
        )
        .name('🗑 Clear saved')
      folder
        .add(
          {
            reset: () => {
              persistence.apply(FACTORY)
              persistence.clear()
              onApply()
              console.info('[usePresets] reset to factory')
            }
          },
          'reset'
        )
        .name('♻️ Reset to factory')
    }
  }
}
