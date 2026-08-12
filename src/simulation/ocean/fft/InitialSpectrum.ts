import { Spectrum } from '../spectrums/Spectrum'
import { SpectrumEvaluationContext } from '../spectrums/types/SpectrumEvaluationContext'
import { ComplexBuffer } from './ComplexBuffer'
import { FFTGridConfig } from './types/FFTGridConfig'
import { InitialSpectrumConfig } from './types/InitialSpectrumConfig'

/**
 * 初始频谱 h₀(k) 和 h₀*(-k) 生成器
 *
 * 对比 Complex[][] 版本的改进：连续内存布局，缓存友好
 *
 */
export class InitialSpectrum {
  private readonly h0: ComplexBuffer
  private readonly h0Conj: ComplexBuffer
  private readonly N: number
  private readonly L: number

  constructor(
    // params: OceanParams,
    // spectrum: Spectrum
    grid: FFTGridConfig,
    config: InitialSpectrumConfig,
    context: SpectrumEvaluationContext,
    spectrum: Spectrum
  ) {
    // this.N = params.fftResolution
    // this.L = params.size
    this.N = grid.fftResolution
    this.L = grid.size

    this.h0 = new ComplexBuffer(this.N)
    this.h0Conj = new ComplexBuffer(this.N)

    // this.generate(params, spectrum)
    this.generate(config, context, spectrum)
    this.buildConjugate()
  }

  // private generate(params: OceanParams, spectrum: Spectrum): void {
  //   const N = this.N
  //   const half = N / 2
  //   // 全局 amplitude，作为最终缩放作用在每层的 h0 上
  //   const globalScale = params.amplitude ?? 1.0

  //   for (let n = 0; n < N; n++) {
  //     for (let m = 0; m < N; m++) {
  //       // DC 分量 = 0（ComplexBuffer 构造时已全零，直接跳过）
  //       if (n === 0 && m === 0) continue

  //       // kx 对应 Texture Y 轴，kz 对应 Texture X 轴（详见 Debug-Claude.md）
  //       // const kx = this.waveNumber(n)
  //       // const kz = this.waveNumber(m)

  //       // kx 对应 Texture X 轴，kz 对应 Texture Y 轴（详见 Debug-Claude.md）
  //       const kx = this.waveNumber(m)
  //       const kz = this.waveNumber(n)
  //       const h0Mag = spectrum.calculateH0Magnitude(kx, kz, params) * globalScale

  //       const factor = h0Mag / Math.sqrt(2)

  //       const xi_r = InitialSpectrum.gaussianRandom()
  //       const xi_i = InitialSpectrum.gaussianRandom()

  //       const isNyquist =
  //         (n === 0 && m === half) || (n === half && m === 0) || (n === half && m === half)

  //       this.h0.set(n, m, factor * xi_r, isNyquist ? 0 : factor * xi_i)
  //     }
  //   }
  // }

  private generate(
    config: InitialSpectrumConfig,
    context: SpectrumEvaluationContext,
    spectrum: Spectrum
  ): void {
    const N = this.N
    const half = N / 2
    const globalScale = config.amplitude ?? 1.0

    for (let n = 0; n < N; n++) {
      for (let m = 0; m < N; m++) {
        if (n === 0 && m === 0) continue

        const kx = this.waveNumber(m)
        const kz = this.waveNumber(n)

        const h0Mag = spectrum.calculateH0Magnitude(kx, kz, context) * globalScale

        const factor = h0Mag / Math.sqrt(2)

        const xi_r = InitialSpectrum.gaussianRandom()
        const xi_i = InitialSpectrum.gaussianRandom()

        const isNyquist =
          (n === 0 && m === half) || (n === half && m === 0) || (n === half && m === half)

        this.h0.set(n, m, factor * xi_r, isNyquist ? 0 : factor * xi_i)
      }
    }
  }

  private buildConjugate(): void {
    const N = this.N
    for (let n = 0; n < N; n++) {
      for (let m = 0; m < N; m++) {
        if (n === 0 && m === 0) continue
        const nc = n === 0 ? 0 : N - n
        const mc = m === 0 ? 0 : N - m
        this.h0Conj.set(n, m, this.h0.getReal(nc, mc), -this.h0.getImag(nc, mc))
      }
    }
  }

  /**
   *
   * 波数分量 k_x 的定义：
   * k_x = (2π * n) / L，其中整数 n 的取值范围是 {-N/2, -N/2 + 1, ..., N/2 - 1}
   * k_x = (2 * math.pi * n) / L
   *
   * 波数分量 k_z 的定义：
   * k_z = (2π * m) / L，其中整数 m 的取值范围是 {-N/2, -N/2 + 1, ..., N/2 - 1}
   * k_z = (2 * math.pi * m) / L
   *
   * @param index 采样点索引
   * @returns 波频率索引
   */
  private waveNumber(index: number): number {
    const n = index < this.N / 2 ? index : index - this.N
    return (2 * Math.PI * n) / this.L
  }

  private static gaussianRandom(): number {
    let u1 = 0
    let u2 = 0
    while (u1 === 0) u1 = Math.random()
    while (u2 === 0) u2 = Math.random()
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  }

  getH0(): ComplexBuffer {
    return this.h0
  }
  getH0Conj(): ComplexBuffer {
    return this.h0Conj
  }
}
