/**
 * InitialSpectrum 生成阶段的配置。
 */
export interface InitialSpectrumConfig {
  /**
   * 对最终 h0 幅度施加的全局线性缩放。
   *
   * 它不是 Phillips 模型中的 A。
   */
  readonly amplitude?: number
}
