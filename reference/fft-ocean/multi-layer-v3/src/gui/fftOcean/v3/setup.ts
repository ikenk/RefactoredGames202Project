import { GUI } from 'dat.gui'
import type { FFTOceanGUIDeps } from '@/gui/fftOcean/types/setup-v3'
import { useTiering } from './hooks/useTiering'
import { usePersistence } from './hooks/usePersistence'
import { usePresets } from './hooks/usePresets'
import {
  ControlDescriptor,
  HOT_TUNING_DESCRIPTORS,
  SSS_DESCRIPTORS,
  PBR_DESCRIPTORS,
  FOAM_MAT_DESCRIPTORS,
  FOG_DESCRIPTORS,
  NORMAL_MASK_DESCRIPTORS,
  buildLayerDescriptors
} from './descriptors' // ← 同级文件，不要 /fftOceanDescriptors

const STORAGE_KEY = 'fftOcean.gui.v3.snapshot'
const LAYER_LABELS = ['主涌浪', '风浪', '短波', '毛细波'] as const

interface SectionSpec {
  name: string
  open?: boolean
  descriptors: ControlDescriptor[]
}

const MATERIAL_SECTIONS: SectionSpec[] = [
  { name: '⭐ Hot Tuning', open: true, descriptors: HOT_TUNING_DESCRIPTORS },
  { name: '🎨 Material - SSS & Color', descriptors: SSS_DESCRIPTORS },
  { name: '💎 Material - PBR (other)', descriptors: PBR_DESCRIPTORS },
  { name: '🌊 Material - Foam', descriptors: FOAM_MAT_DESCRIPTORS },
  { name: '🌫 Material - Fog', descriptors: FOG_DESCRIPTORS },
  { name: '🧭 Material - Normal & Mask', descriptors: NORMAL_MASK_DESCRIPTORS }
]

export function setupFFTOceanGUI(gui: GUI, deps: FFTOceanGUIDeps): GUI {
  const persistence = usePersistence(deps.config, STORAGE_KEY)
  const tiering = useTiering(deps)
  const restored = persistence.restore()

  MATERIAL_SECTIONS.forEach((s) => {
    const folder = gui.addFolder(s.name)
    s.descriptors.forEach((d) => tiering.addControl(folder, d, persistence.markDirty))
    if (s.open) folder.open()
  })

  const layerDescriptors: ControlDescriptor[][] = []
  deps.config.oceanParamsCascade.forEach((layer, i) => {
    const label = LAYER_LABELS[i] ?? ''
    const lf = gui.addFolder(`📐 Layer ${i} (size=${layer.size}, ${label})`)
    const descs = buildLayerDescriptors(i)
    layerDescriptors.push(descs)
    descs.forEach((d) => tiering.addControl(lf, d, persistence.markDirty))
    if (i === 0) lf.open()
  })

  const allDescriptors: ControlDescriptor[] = [
    ...MATERIAL_SECTIONS.flatMap((s) => s.descriptors),
    ...layerDescriptors.flat()
  ]
  const pushAllToGPU = (): void => tiering.pushAll(allDescriptors)

  usePresets(deps.config, persistence, pushAllToGPU).attachUI(gui)

  if (restored) pushAllToGPU()

  return gui
}
