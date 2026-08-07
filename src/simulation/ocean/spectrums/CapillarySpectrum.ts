import type { Spectrum } from './Spectrum'
import { ResolvedCapillarySpectrumConfig } from './types/CapillarySpectrumConfig'
import type { SpectrumEvaluationContext } from './types/SpectrumEvaluationContext'

/**
 * 毛细波谱（Capillary Wave Spectrum）
 *
 * 补充高频细节，模拟表面张力主导的微小波纹。
 *
 * 物理背景：
 * - 毛细波色散关系: ω = √(gk + σk³/ρ)
 *   σ = 0.074 N/m（水的表面张力系数）
 *   ρ = 1000 kg/m³（水密度）
 * - 当 k > 1 rad/m 时毛细效应才显著
 * - 使用指数衰减 exp(-k/k_cutoff) 限制超高频
 * - capillaryFactor/(gravityFactor+capillaryFactor) 平滑过渡：
 *   低 k → 0（不干扰重力波），高 k → 1（完全由表面张力主导）
 */
export class CapillarySpectrum implements Spectrum {
  /** 基础振幅 */
  private readonly baseAmplitude: number
  /** 截止波数 (rad/m) */
  private readonly cutoffWavenumber: number
  private readonly surfaceTension: number
  private readonly waterDensity: number

  constructor(config: ResolvedCapillarySpectrumConfig) {
    this.baseAmplitude = config.baseAmplitude
    this.cutoffWavenumber = config.cutoffWavenumber
    this.surfaceTension = config.surfaceTension
    this.waterDensity = config.waterDensity
  }

  calculateH0Magnitude(kx: number, kz: number, context: SpectrumEvaluationContext): number {
    const k = Math.sqrt(kx * kx + kz * kz)

    if (k < 1) return 0

    const capillaryFactor = (this.surfaceTension * k * k * k) / this.waterDensity

    const gravityFactor = context.gravity * k

    return (
      this.baseAmplitude *
      Math.exp(-k / this.cutoffWavenumber) *
      (capillaryFactor / (gravityFactor + capillaryFactor))
    )
  }
}
