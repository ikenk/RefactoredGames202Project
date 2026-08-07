import type { SpectrumEvaluationContext } from './types/SpectrumEvaluationContext'

/**
 * 波谱模型的统一求值接口。
 *
 * 模型专属配置在 Spectrum 创建时提供；当前层共享的物理环境在求值时提供。
 */
export interface Spectrum {
  /**
   * 计算离散初始频谱 h0(k) 的幅度。
   *
   * @param kx 波向量 X 分量，单位 rad/m。
   * @param kz 波向量 Z 分量，单位 rad/m。
   * @param context 当前 cascade 层共享的求值环境。
   * @returns 不包含随机相位的 h0 幅度。
   */
  calculateH0Magnitude(kx: number, kz: number, context: SpectrumEvaluationContext): number
}
