/**
 * 创建 CapillarySpectrum 时允许调用方提供的配置。
 */
export interface CapillarySpectrumConfig {
  /** 毛细波基础振幅；默认 0.001，必须大于等于 0。 */
  readonly baseAmplitude?: number

  /** 高频指数衰减的截止波数，单位 rad/m；默认 100，必须大于 0。 */
  readonly cutoffWavenumber?: number

  /** 水的表面张力系数，单位 N/m；默认 0.074，必须大于 0。 */
  readonly surfaceTension?: number

  /** 水密度，单位 kg/m³；默认 1000，必须大于 0。 */
  readonly waterDensity?: number
}

/**
 * 完成默认值补全和范围校验后的 Capillary 配置。
 */
export interface ResolvedCapillarySpectrumConfig {
  readonly baseAmplitude: number
  readonly cutoffWavenumber: number
  readonly surfaceTension: number
  readonly waterDensity: number
}
