/**
 * FFT 离散网格配置。
 */
export interface FFTGridConfig {
  /** 海面的物理边长 L，单位 m。 */
  readonly size: number

  /** FFT 纹理分辨率，必须为 2 的幂。 */
  readonly fftResolution: number
}
