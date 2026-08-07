import type { FFTGridConfig } from './FFTGridConfig'

/** GPU 计算 h(k,t) 时真正需要的网格与物理参数。 */
export interface FFTSpectrumEvolutionConfig extends FFTGridConfig {
  /** 重力加速度，单位 m/s²。 */
  readonly gravity: number
}
