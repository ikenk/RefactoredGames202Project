// import { ILight } from '@/lights/types/light'

export interface LightGUIConfig {
  name: string
  positionRange: PositionRange
  /** PCSS 光源物理尺寸的可调范围（仅 DirectionalLight） */
  worldSizeRange?: [number, number] // 例如 [0.5, 50]
}

interface PositionRange {
  x: [number, number]
  y: [number, number]
  z: [number, number]
}
