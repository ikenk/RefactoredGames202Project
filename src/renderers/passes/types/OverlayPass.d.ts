import { BaseRenderer } from '@/renderers/BaseRenderer'

export interface HUDEntry {
  renderer: BaseRenderer
  position: { x: number; y: number }
  size: number
}
