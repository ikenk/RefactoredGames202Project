import { Vec2 } from '@/math/types/math'
import { WaterMaterialConfig } from './WaterMaterialConfig'

export interface GerstnerWaveParams {
  direction: Vec2 // 波浪传播方向
  steepness: number // 陡峭度
  wavelength: number // 波长
  speedMultiplier: number // 速度倍数
  phase?: number // 相位偏移
}

/** Gerstner Wave 特有参数 */
export interface GerstnerWaveMaterialConfig extends WaterMaterialConfig {
  waveCount?: number // 实际使用的波数量（≤8）
  waves?: GerstnerWaveParams[] // 最多 8 个波
}
