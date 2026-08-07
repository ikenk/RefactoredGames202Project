/**
 * 当前 cascade 进行波谱求值时，共享且已经校验的物理参数。
 *
 * 模型专属参数，例如 windSpeed、spectrum0、spectrum1，
 * 不应该放在这里。
 */
export interface SpectrumEvaluationContext {
  /** 海面物理边长 L，单位 m。 */
  readonly size: number

  /** 重力加速度 g，单位 m/s²。 */
  readonly gravity: number

  /**
   * 水深，单位 m。
   *
   * undefined 明确表示采用深水极限，
   * 而不是自动补成 1000m。
   */
  readonly depth?: number

  /** 最小波数；undefined 表示不额外做下界截断。 */
  readonly kMin?: number

  /** 最大波数；undefined 表示不额外做上界截断。 */
  readonly kMax?: number
}
