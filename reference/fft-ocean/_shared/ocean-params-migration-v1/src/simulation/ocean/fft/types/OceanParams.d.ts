import { Vec2 } from '@/math/types/math'
import { SpectrumSettings } from '../../spectrums/types/SpectrumSettings'

/** 纯频谱参数 -- 给 FFT 计算用 */
export interface OceanParams {
  /** 海面物理尺寸 (m) -- size 是"频谱空间 -> 物理空间"的换算单位，Tessendorf 频谱里所有波数 k = 2π·n/L，这个 L 就是 size */
  size: number
  /** Compute Texture 分辨率，必须是 2 的幂 */
  fftResolution: number
  /** 重力加速度 (m/s²) */
  gravity: number
  /** x/y 轴的波浪尖锐度（choppy waves 系数 λ） */
  choppiness: Vec2
  /** 水深 (m)，用于有限深度色散 */
  depth?: number
  /** 能量缩放系数（作用于最终 |h0| 的线性倍数） */
  amplitude?: number
  /** 采样侧混合权重（艺术量），默认 1.0 */
  layerContribute?: number

  // ====== 双子谱（wind + swell）======
  /** 主子谱（风浪）；未提供时退化为单一子谱 */
  spectrum0?: SpectrumSettings
  /** 次子谱（涌浪 / 第二风向风浪）；可选 */
  spectrum1?: SpectrumSettings

  // ====== 波数(wave number) 截断（kMax + kMin）======
  /** 被保留的最大 k */
  /** 被保留的最小 k */
  kMax?: number
  kMin?: number

  // ====== 兼容字段（单子谱时的快捷写法，会被 spectrum0 覆盖）======
  /** 风速 (m/s) */
  windSpeed?: number
  /** 风向（归一化） */
  windDirection?: { x: number; y: number }
  /** 风区大小 (m)，JONSWAP 谱需要 */
  fetch?: number
  /** 风浪-涌浪混合参数 ξ，JONSWAP Hasselmann 方向扩展使用，默认 0（纯风浪） */
  swellMixing?: number

  // ====== Foam ======
  foamDecayRate?: number // 默认 0.05
  foamAdd?: number // 默认 0.1
  foamBias?: number // 默认 0.2
  foamPower?: number // 默认 1.5
}
