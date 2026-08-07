// import { OceanParams } from '../fft/types/OceanParams'
import type { Spectrum } from './Spectrum'
import type { ResolvedPhillipsSpectrumConfig } from './types/PhillipsSpectrumConfig'
import type { SpectrumEvaluationContext } from './types/SpectrumEvaluationContext'
/**
 * Phillips 波谱
 *
 * 基础公式：
 *   P(k) = A · exp(-1/(kL)²) / k⁴ · |k̂ · ŵ|
 *
 * 其中：
 *   k = √(kx² + kz²)          波向量模长
 *   L = U² / g                 最大波长（U: 风速, g: 重力加速度）
 *   k̂ = k / |k|               波向量单位方向
 *   ŵ                          风向单位向量
 *   |k̂ · ŵ|                   方向分布（使用绝对值而非平方，对侧向波保留更多能量）
 *   exp(-1/(kL)²)              抑制波长远大于 L 的波
 *   k⁻⁴                       高频衰减
 *
 * 逆风波处理：
 *   当 k̂ · ŵ < 0（逆风方向）时，乘以衰减系数 damping 而非直接置零，
 *   允许少量逆风波存在以增加真实感。
 */
export class PhillipsSpectrum implements Spectrum {
  /**
   * Phillips 常数 A，控制整体波浪强度
   *
   *   0.002  很弱的波浪
   *   0.005  轻微波浪
   *   0.008  标准波浪 <= 推荐起始值
   *   0.015  较强波浪
   *   0.025  很强的波浪
   */
  // private readonly A: number
  private readonly amplitude: number

  private readonly windSpeed: number
  private readonly windX: number
  private readonly windY: number

  /** 逆风波衰减系数（0 = 完全抑制，1 = 不衰减） */
  private readonly opposingWaveDamping: number

  /**
   * 使用已解析配置创建 Phillips 波谱。
   *
   * @param config 已完成默认值补全、范围校验和风向归一化的不可变配置。
   */
  constructor(config: ResolvedPhillipsSpectrumConfig) {
    this.windSpeed = config.windSpeed
    this.windX = config.windDirection.x
    this.windY = config.windDirection.y
    this.amplitude = config.amplitude
    this.opposingWaveDamping = config.opposingWaveDamping
  }

  /**
   * 计算连续 Phillips 功率谱 P(k)。
   *
   * @param kx 波向量 X 分量，单位 rad/m。
   * @param kz 波向量 Z 分量，单位 rad/m。
   * @param gravity 重力加速度，单位 m/s²；已由工厂验证为正数。
   * @returns 当前波向量处的非负功率谱值。
   */
  private calculatePowerSpectrum(kx: number, kz: number, gravity: number): number {
    const kSquared = kx * kx + kz * kz
    if (kSquared < 1e-6) return 0

    const k = Math.sqrt(kSquared)
    const largestWaveScale = (this.windSpeed * this.windSpeed) / gravity
    const waveDirectionX = kx / k
    const waveDirectionZ = kz / k
    const alignment = waveDirectionX * this.windX + waveDirectionZ * this.windY

    const power =
      (this.amplitude *
        Math.exp(-1 / (kSquared * largestWaveScale * largestWaveScale)) *
        Math.abs(alignment)) /
      (kSquared * kSquared)

    return power * (alignment < 0 ? this.opposingWaveDamping : 1)
  }

  // /**
  //  * 计算 Phillips 谱值 P(k)
  //  */
  // private calculatePk(kx: number, kz: number, params: Required<OceanParams>): number {
  //   const k2 = kx * kx + kz * kz
  //   if (k2 < 1e-6) return 0
  //   const k = Math.sqrt(k2)

  //   const windSpeed = params.windSpeed
  //   const windDirection = params.windDirection ?? { x: 1, y: 0 }
  //   const L = (windSpeed * windSpeed) / params.gravity
  //   // const L = (params.windSpeed * params.windSpeed) / params.gravity

  //   // 归一化风向
  //   // const windLen = Math.sqrt(params.windDirection.x ** 2 + params.windDirection.y ** 2)
  //   // const wx = params.windDirection.x / windLen
  //   // const wy = params.windDirection.y / windLen
  //   const windLen = Math.sqrt(windDirection.x ** 2 + windDirection.y ** 2)
  //   const wx = windDirection.x / windLen
  //   const wy = windDirection.y / windLen

  //   // 波向量与风向的夹角余弦
  //   const kxNorm = kx / k
  //   const kzNorm = kz / k
  //   const kw = kxNorm * wx + kzNorm * wy

  //   // P(k) = A · exp(-1/(kL)²) · |k̂·ŵ| / k⁴
  //   const phillips = (this.A * Math.exp(-1 / (k2 * L * L)) * Math.abs(kw)) / (k2 * k2)

  //   // 逆风波衰减
  //   return phillips * (kw < 0 ? this.damping : 1.0)
  // }

  // calculateH0Magnitude(kx: number, kz: number, params: OceanParams): number {
  //   const L = params.size
  //   const P = this.calculatePk(kx, kz, params) * ((4 * Math.PI * Math.PI) / (L * L))
  //   return Math.sqrt(P / 2)
  // }

  /**
   * 计算离散初始频谱 h₀(k) 的幅度。
   *
   * 连续功率谱通过 `Δk² = (2π/L)²` 转换到离散网格，并使用
   * `sqrt(P · Δk² / 2)` 得到供高斯随机变量缩放的幅度。
   */
  calculateH0Magnitude(kx: number, kz: number, context: SpectrumEvaluationContext): number {
    const power = this.calculatePowerSpectrum(kx, kz, context.gravity)
    const deltaKSquared = (4 * Math.PI * Math.PI) / (context.size * context.size)

    return Math.sqrt((power * deltaKSquared) / 2)
  }
}
