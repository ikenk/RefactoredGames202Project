// import { OceanParams } from '../fft/types/OceanParams'
import type { Spectrum } from './Spectrum'
import type { JONSWAPSpectrumConfig } from './types/JONSWAPSpectrumConfig'
import type { SpectrumSettings } from './types/SpectrumSettings'
import type { SpectrumEvaluationContext } from './types/SpectrumEvaluationContext'

/**
 * JONSWAP 波谱（参考 FFT-Ocean-Code-main / Tessendorf 流派）
 *
 *  1. 每层可叠加两套子谱（风浪 spectrum0 + 涌浪 spectrum1）
 *  2. 每套子谱独立参数：scale / windSpeed / windDir / fetch / spreadBlend /
 *  swell / peakEnhancement / shortWavesFade
 *  3. 方向扩散 = mix(1.0, cos²s·波·风, spreadBlend)  ← 作者的线性混合写法
 *  4. 短波衰减 = exp(-k²·shortWavesFade²)
 *  5. TMA 深水修正（仅 depth < 50m 时启用）
 *  6. h₀ 幅度：|h₀|² = 2·spec·|F|/k ·(4π²/L²)（Δk² 在此处）
 *     最终 InitialSpectrum 里再 sqrt 并乘 Gaussian 随机噪声
 *
 * ===== 公式索引 =====
 * [7] F = g·(d·k/cosh²(dk) + tanh(min(20,dk)))
 *
 * 参考文献：
 * - Hasselmann et al. (1973) "Measurements of wind-wave growth and swell decay"
 * - https://geo.libretexts.org/Bookshelves/Oceanography
 *
 * === 非方向性频率谱 ===
 * [公式1] S(ω) = (αg²/ω⁵) · exp(-5/4·(ωp/ω)⁴) · γ^r
 * [公式2] r = exp(-(ω-ωp)² / (2σ²ωp²))
 * [公式3] γ = 3.3（峰值增强因子）
 * [公式4] α = 0.076 · (U²/(Fg))^0.22（Phillips 常数）
 * [公式5] ωp = 22 · (g²/(UF))^(1/3)（峰值频率）
 * [公式6] σ = 0.07 (ω ≤ ωp), 0.09 (ω > ωp)
 *
 * === 水深修正（TMA） ===
 * [公式7] Φ(ωh) = 0.5·ωh² (ωh≤1), 1-0.5·(2-ωh)² (1<ωh<2), 1.0 (ωh≥2)
 * [公式8] J = S(ω) · Φ(ωh)
 *
 * === 方向扩展 ===
 * [公式9]  spec = J · D(ω,θ) · swave
 * [公式10] F = g · { d|k|/cosh²(d|k|) + tanh[min(20, d|k|)] }
 * [公式11] h₀(k) = √(2 · spec · |F|/|k| · 4π²/L²)
 *
 * === Hasselmann 方向分布 ===
 * [公式12] s = sp(ω, ωp) + sξ
 * [公式13] sp = 6.97·(ω/ωp)^5 (ω≤ωp), 6.97·(ω/ωp)^(-2.5)(ω>ωp)
 * [公式14] sξ = 16·tanh(ωp/ω) · ξ²
 * [公式15] D(ω,θ) = C(s) · |cos(θ/2)|^(2s)
 *
 * === 短波过滤 ===
 * [公式16] swave = exp(-(f·|k|)²), f = 0.01
 */
export class JONSWAPSpectrum implements Spectrum {
  private readonly sigma_a = 0.07
  private readonly sigma_b = 0.09

  private readonly primary: JONSWAPSpectrumConfig['primary']
  private readonly secondary: JONSWAPSpectrumConfig['secondary']

  constructor(config: JONSWAPSpectrumConfig) {
    this.primary = config.primary
    this.secondary = config.secondary
  }

  // ========== 默认子谱（当 spectrum0/1 都缺失时的兜底）==========
  // private defaultSpectrum(params: OceanParams): SpectrumSettings {
  //   const windDirDeg =
  //     params.windDirection !== undefined
  //       ? (Math.atan2(params.windDirection.y, params.windDirection.x) * 180) / Math.PI
  //       : 0
  //   return {
  //     scale: params.amplitude ?? 1.0,
  //     windSpeed: params.windSpeed ?? 5,
  //     windDirection: windDirDeg,
  //     fetch: params.fetch ?? 100000,
  //     spreadBlend: 1.0,
  //     swell: params.swellMixing ?? 0.0,
  //     peakEnhancement: 3.3,
  //     shortWavesFade: 0.01
  //   }
  // }

  // ==================== 基础频率量 ====================

  private alpha(windSpeed: number, fetch: number, g: number): number {
    const dim = (windSpeed * windSpeed) / (fetch * g)
    return 0.076 * Math.pow(dim, 0.22)
  }

  private omegaPeak(windSpeed: number, fetch: number, g: number): number {
    const dim = (g * g) / (windSpeed * fetch)
    return 22 * Math.pow(dim, 1 / 3)
  }

  private gammaFactor(omega: number, omegaPeak: number, gamma: number): number {
    const sigma = omega <= omegaPeak ? this.sigma_a : this.sigma_b
    const r = Math.exp(
      -Math.pow(omega - omegaPeak, 2) / (2 * sigma * sigma * omegaPeak * omegaPeak)
    )
    return Math.pow(gamma, r)
  }

  // ==================== 波浪的色散关系(用来计算omega) ====================
  private calDispersion(kLength: number, g: number, depth: number) {
    // min()是在进行优化
    return Math.sqrt(g * kLength * Math.tanh(Math.min(kLength * depth, 20)))
  }

  // ==================== S(ω) ====================
  /** 非方向性 JONSWAP S(ω) [公式1] */
  private SOmega(omega: number, settings: SpectrumSettings, g: number): number {
    // 公式参数准备
    const omegaPeak = this.omegaPeak(settings.windSpeed, settings.fetch, g)
    const alpha = this.alpha(settings.windSpeed, settings.fetch, g)
    const oneOverOmega = 1.0 / omega
    const peakOmegaOverOmega = omegaPeak / omega

    const phillipsBase = alpha * g * g * Math.pow(oneOverOmega, 5)
    const exponential = Math.exp(-1.25 * Math.pow(peakOmegaOverOmega, 4))
    const gamma = this.gammaFactor(omega, omegaPeak, settings.peakEnhancement)

    return phillipsBase * exponential * gamma
  }

  // ==================== TMA 修正 [公式6] ====================
  private calTMACorrection(omega: number, depth: number, g: number): number {
    const wh = omega * Math.sqrt(depth / g)
    if (wh <= 1) return 0.5 * wh * wh
    if (wh < 2) return 1 - 0.5 * Math.pow(2 - wh, 2)
    return 1.0
  }

  // ==================== 方向扩散（作者线性混合版本）====================
  /**
   * D(θ,ω) = mix(1.0, cos²s·方向能量, spreadBlend)
   *
   * - spreadBlend = 0 → 各向同性（所有 θ 能量相同）
   * - spreadBlend = 1 → 完全沿风向（cos²s 峰化）
   * - 涌浪项 s_ξ 用 swell 强化低频方向性
   */
  private directionFactor(
    kx: number,
    kz: number,
    omega: number,
    omegaPeak: number,
    settings: SpectrumSettings
  ): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 1e-6) return 0

    // 波的方向
    const theta_wave = Math.atan2(kz, kx)
    // 风的方向（settings.windDirection 单位：度）
    const theta_wind = (settings.windDirection * Math.PI) / 180

    // 相对角度归一化到 [-π, π]
    let theta = theta_wave - theta_wind
    while (theta > Math.PI) theta -= 2 * Math.PI
    while (theta < -Math.PI) theta += 2 * Math.PI

    // [公式5] 方向扩散指数
    const xi = settings.swell
    // const sp = 11.5 * Math.pow(omega / omegaPeak, -2.5)
    const sp = this.calSpreadPower(omega, omegaPeak)
    const s = sp + 16 * Math.tanh(omegaPeak / omega) * xi * xi

    // cos²s 方向权重（2/π 是归一化常数）
    // const directed = (2 / Math.PI) * Math.pow(Math.abs(Math.cos(theta / 2)), 2 * s)
    const cos2s = this.calCosine2s(theta, s)

    // 完全定向 vs 各向同性（1/(2π)）
    // 参数范围限制 blend ∈ [0,1]
    const blend = Math.max(0, Math.min(1, settings.spreadBlend))
    return (1 - blend) * (1 / (2 * Math.PI)) + blend * cos2s
    // return (
    //   (1 - settings.spreadBlend) * (Math.cos(theta) * Math.cos(theta)) +
    //   // settings.spreadBlend * cos2s
    // )
  }

  /** Hasselmann 分段 (低频集中在主方向，高频则相对分散) */
  private calSpreadPower(omega: number, omega_p: number): number {
    const ratio = Math.abs(omega / omega_p)
    let s

    if (omega <= omega_p) {
      // 低频：不要爆炸 → 用 r^5（收敛到0）
      s = 6.97 * Math.pow(ratio, 5)
    } else {
      // 高频：正常衰减
      s = 9.77 * Math.pow(ratio, -2.5)
    }
    return s
    // return clamp(s, 0.0, 16.0)
  }

  private calNormalizationFactor(s: number) {
    const s2 = s * s
    const s3 = s2 * s
    const s4 = s3 * s

    if (s < 5) {
      return -0.000564 * s4 + 0.00776 * s3 - 0.044 * s2 + 0.192 * s + 0.163
    } else {
      return -4.8e-8 * s4 + 1.07e-5 * s3 - 9.53e-4 * s2 + 5.9e-2 * s + 3.93e-1
    }
  }

  // 通用的方向扩散模型
  private calCosine2s(theta: number, s: number) {
    return this.calNormalizationFactor(s) * Math.pow(Math.abs(Math.cos(0.5 * theta)), 2.0 * s)
  }

  // ==================== 色散导数 F [公式7] ====================
  // private calculateF(k: number, depth: number, g: number): number {
  //   const d = Math.max(1e-12, depth)
  //   const kd = k * d
  //   const cosh_kd = Math.cosh(Math.min(kd, 20))
  //   const sech2 = 1 / (cosh_kd * cosh_kd)
  //   const tanhClamped = Math.tanh(Math.min(20, kd))
  //   return g * (kd * sech2 + tanhClamped)
  // }

  private calDispersionDerivative(kLength: number, g: number, depth: number) {
    const tanH = Math.tanh(Math.min(kLength * depth, 20))
    const cosH = Math.cosh(kLength * depth)
    return (
      (g * ((depth * kLength) / cosH / cosH + tanH)) / this.calDispersion(kLength, g, depth) / 2.0
    )
  }

  // ==================== 短波衰减 ====================
  private shortWaveFade(kLength: number, shortWavesFade: number): number {
    const kf = kLength * shortWavesFade
    return Math.exp(-(kf * kf))
  }

  // ==================== 单子谱能量：spec = S·Φ·D·fade ====================
  // private singleSpectrumEnergy(
  //   kx: number,
  //   kz: number,
  //   params: OceanParams,
  //   settings: SpectrumSettings
  // ): number {
  private singleSpectrumEnergy(
    kx: number,
    kz: number,
    context: SpectrumEvaluationContext,
    settings: SpectrumSettings
  ): number {
    const kLength = Math.sqrt(kx * kx + kz * kz)
    if (kLength < 1e-6) return 0

    const g = context.gravity
    const omega = Math.sqrt(g * kLength)
    const wp = this.omegaPeak(settings.windSpeed, settings.fetch, g)

    const S = this.SOmega(omega, settings, g)
    // const tmaCorrection =
    //   params.depth && params.depth > 0 && params.depth < 50
    //     ? this.calTMACorrection(omega, params.depth, g)
    //     : 1.0
    const tmaCorrection = context.depth ? this.calTMACorrection(omega, context.depth, g) : 1.0
    const D = this.directionFactor(kx, kz, omega, wp, settings)
    const fade = this.shortWaveFade(kLength, settings.shortWavesFade)

    // scale 是能量线性缩放（未开平方）
    return settings.scale * S * tmaCorrection * D * fade
  }

  // ==================== 对外 API：|h₀(k)| ====================
  // calculateH0Magnitude(kx: number, kz: number, params: OceanParams): number {
  calculateH0Magnitude(kx: number, kz: number, context: SpectrumEvaluationContext): number {
    const kLength = Math.sqrt(kx * kx + kz * kz)
    // k 截断范围，可调（很关键）
    const kMin = context.kMin ?? 0.0001
    const kMax = context.kMax ?? 9000.0

    if (kLength < kMin || kLength > kMax) return 0

    // 双子谱叠加（spec0 + spec1）
    // const s0 = params.spectrum0 ?? this.defaultSpectrum(params)
    // const spec0 = this.singleSpectrumEnergy(kx, kz, params, s0)
    // const spec1 = params.spectrum1 ? this.singleSpectrumEnergy(kx, kz, params, params.spectrum1) : 0

    const spec0 = this.singleSpectrumEnergy(kx, kz, context, this.primary)
    const spec1 = this.secondary ? this.singleSpectrumEnergy(kx, kz, context, this.secondary) : 0
    const spec = spec0 + spec1

    // F 和 depth 是全局的（非子谱级别）, F = 2⋅ω⋅(dω/dk)
    // const F = this.calculateF(kLength, params.depth ?? 1000, params.gravity)
    const dOmegadk = this.calDispersionDerivative(kLength, context.gravity, context.depth ?? 1000)

    // k -- 波数（波矢）= 2 * PI * m / L
    // Δk -- 波数（波矢）的精细程度 = 2 * PI * (m + 1) / L - 2 * PI * m / L = 2 * PI / L
    // |h₀|² = 2⋅S(ω,θ)⋅((dω/dk)⋅Δk)⋅((1/k)⋅Δk), Δk = 2·PI/L
    const L = context.size
    const amplitudeSquared =
      2 * ((spec * Math.abs(dOmegadk)) / kLength) * ((4 * Math.PI * Math.PI) / (L * L))
    // const amplitudeSquared = 2 * ((spec * Math.abs(F)) / k)

    return Math.sqrt(Math.max(0, amplitudeSquared))
  }
}
