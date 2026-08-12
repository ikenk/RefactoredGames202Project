/**
 * FFTOceanGUI v4 ─ 基于 Tweakpane 的模块化版本
 */

import type { Pane } from 'tweakpane'
import { useTiering } from './hooks/useTiering'
import { usePersistence } from './hooks/usePersistence'
import { usePresets } from './hooks/usePresets'
import type { FFTOceanGUIDeps } from '@/gui/fftOcean/types/setup-v4'
import {
  ControlDescriptor,
  HOT_TUNING_DESCRIPTORS,
  SSS_DESCRIPTORS,
  PBR_DESCRIPTORS,
  FOAM_MAT_DESCRIPTORS,
  FOG_DESCRIPTORS,
  NORMAL_MASK_DESCRIPTORS,
  buildLayerDescriptors
} from './descriptors'

const STORAGE_KEY = 'fftOcean.gui.v5.snapshot'
const LAYER_LABELS = ['主涌浪', '风浪', '短波', '毛细波'] as const

interface SectionSpec {
  name: string
  expanded?: boolean
  descriptors: ControlDescriptor[]
}

const MATERIAL_SECTIONS: SectionSpec[] = [
  { name: '⭐ Hot Tuning', expanded: true, descriptors: HOT_TUNING_DESCRIPTORS },
  { name: '🎨 Material - SSS & Color', descriptors: SSS_DESCRIPTORS },
  { name: '💎 Material - PBR (other)', descriptors: PBR_DESCRIPTORS },
  { name: '🌊 Material - Foam', descriptors: FOAM_MAT_DESCRIPTORS },
  { name: '🌫 Material - Fog', descriptors: FOG_DESCRIPTORS },
  { name: '🧭 Material - Normal & Mask', descriptors: NORMAL_MASK_DESCRIPTORS }
]

export function setupFFTOceanGUI(pane: Pane, deps: FFTOceanGUIDeps): Pane {
  const persistence = usePersistence(deps.config, STORAGE_KEY)
  const tiering = useTiering(deps)
  const restored = persistence.restore()

  MATERIAL_SECTIONS.forEach((s) => {
    const folder = pane.addFolder({ title: s.name, expanded: s.expanded ?? false })
    s.descriptors.forEach((d) => tiering.addControl(folder, d, persistence.markDirty))
  })

  const layerDescriptors: ControlDescriptor[][] = []
  deps.config.layers.forEach((layer, i) => {
    const label = LAYER_LABELS[i] ?? ''
    const lf = pane.addFolder({
      title: `📐 Layer ${i} (size=${layer.grid.size}, ${label})`,
      expanded: i === 0
    })
    const descs = buildLayerDescriptors(i, layer.spectrum.model)
    layerDescriptors.push(descs)
    descs.forEach((d) => tiering.addControl(lf, d, persistence.markDirty))
  })

  const allDescriptors: ControlDescriptor[] = [
    ...MATERIAL_SECTIONS.flatMap((s) => s.descriptors),
    ...layerDescriptors.flat()
  ]
  const pushAllToGPU = (): void => tiering.pushAll(allDescriptors)

  usePresets(deps.config, persistence, pushAllToGPU).attachUI(pane)

  if (restored) pushAllToGPU()

  return pane
}
