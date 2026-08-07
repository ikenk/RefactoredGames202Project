import type { Vec2 } from '@/math/types/math'

/** FFT 单层在逐帧 assembly 阶段使用的运行参数。 */
export interface FFTOceanLayerRuntimeConfig {
  readonly choppiness: Vec2
  readonly foamDecayRate: number
  readonly foamAdd: number
  readonly foamBias: number
  readonly foamPower: number
}

export type FFTOceanFoamParameterKey = 'foamDecayRate' | 'foamAdd' | 'foamBias' | 'foamPower'
