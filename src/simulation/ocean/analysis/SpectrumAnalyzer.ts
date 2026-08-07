import { Spectrum } from '../spectrums/Spectrum'
import { OceanParams } from '../fft/types/OceanParams'
import { SpectrumReport } from './types/SpectrumAnalyzer'
import { SpectrumEvaluationContext } from '../spectrums/types/SpectrumEvaluationContext'
import { FFTGridConfig } from '../fft/types/FFTGridConfig'

export class SpectrumAnalyzer {
  private spectrum: Spectrum

  constructor(spectrum: Spectrum) {
    this.spectrum = spectrum
  }

  /**
   * 通用频谱分析器
   *
   * radial:
   *   频率壳层统计（shell averaging）
   *
   * directional:
   *   方向能量分布
   */
  public analyze(
    // params: OceanParams,
    grid: FFTGridConfig,
    context: SpectrumEvaluationContext,
    radialBinCount = 32,
    directionalBinCount = 16
  ): SpectrumReport {
    // const N = params.fftResolution
    // const L = params.size
    const N = grid.fftResolution
    const L = grid.size

    // Δk = 2π / L
    const deltaK = (2.0 * Math.PI) / L

    // Nyquist frequency
    const kNyquist = (Math.PI * N) / L

    // const radialBins = new Array(radialBinCount).fill(0)
    // const radialCounts = new Array(radialBinCount).fill(0)

    // const directionalBins = new Array(directionalBinCount).fill(0)

    const radialBins = new Array<number>(radialBinCount).fill(0)
    const radialCounts = new Array<number>(radialBinCount).fill(0)
    const directionalBins = new Array<number>(directionalBinCount).fill(0)

    let totalEnergy = 0
    let maxEnergy = 0

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        // centered FFT coordinates
        const kx = (x - N / 2) * deltaK
        const kz = (y - N / 2) * deltaK

        const k = Math.sqrt(kx * kx + kz * kz)

        // normalized frequency
        const kn = k / kNyquist

        // ignore outside Nyquist
        if (kn > 1.0) continue

        // const energy = this.spectrum.calculateH0Magnitude(kx, kz, params)
        const energy = this.spectrum.calculateH0Magnitude(kx, kz, context)

        totalEnergy += energy
        maxEnergy = Math.max(maxEnergy, energy)

        //  radial shell averaging
        const radialIndex = Math.min(radialBinCount - 1, Math.floor(kn * radialBinCount))

        // radialBins[radialIndex] += energy
        // radialCounts[radialIndex]++

        radialBins[radialIndex] = (radialBins[radialIndex] ?? 0) + energy
        radialCounts[radialIndex] = (radialCounts[radialIndex] ?? 0) + 1

        // directional histogram
        let theta = Math.atan2(kz, kx)

        // map [-π, π] → [0, 2π]
        theta += Math.PI

        const directionIndex = Math.min(
          directionalBinCount - 1,
          Math.floor((theta / (2.0 * Math.PI)) * directionalBinCount)
        )

        // directionalBins[directionIndex] += energy
        directionalBins[directionIndex] = (directionalBins[directionIndex] ?? 0) + energy
      }
    }

    // ==================== normalize radial ====================
    const radialNormalized = radialBins.map((v, i) => {
      // if (radialCounts[i] <= 0) return 0
      if ((radialCounts[i] ?? 0) <= 0) return 0
      // 计算当前分箱对应的平均半径
      const kCenter = ((i + 0.5) / radialBinCount) * kNyquist
      // 壳层面积 = 2πkΔk
      const shellArea = 2 * Math.PI * kCenter * (kNyquist / radialBinCount)
      // 能量密度 = 总能量 / 壳层面积
      return v / shellArea

      // return v / totalEnergy
    })

    // 归一化到最大值（方便看形状）
    const maxDensity = Math.max(...radialNormalized)
    const radialNormalizedFinal = radialNormalized.map((v) => (maxDensity > 0 ? v / maxDensity : 0))

    //  normalize directional
    const directionalNormalized = directionalBins.map((v) => {
      return v / totalEnergy
    })

    return {
      totalEnergy,
      maxEnergy,

      radialBins,
      directionalBins,

      radialNormalized: radialNormalizedFinal,
      directionalNormalized
    }
  }

  // ==================== report print ====================
  public printReport(
    report: SpectrumReport,
    // params: OceanParams
    grid: FFTGridConfig
  ): void {
    console.log('========== FFT Calculation Parameters ==========')

    // console.log('FFT Size', params.size)
    console.log('FFT Size', grid.size)

    // console.log('FFT Resolution', params.fftResolution)
    console.log('FFT Resolution', grid.fftResolution)

    console.log('')

    console.log('========== ENERGY ==========')

    console.log('Total Energy:', report.totalEnergy)

    console.log('Max Energy:', report.maxEnergy)

    console.log('')

    const N = grid.fftResolution
    const L = grid.size
    const kNyquist = (Math.PI * N) / L

    console.log('========== RADIAL ENERGY DENSITY ==========')
    console.log('(归一化波数 | 实际波数(rad/m) | 波长(m) | 相对能量密度 | 实际能量占比)')
    console.log('------------------------------------------------')

    report.radialNormalized.forEach((v, i, arr) => {
      const binCount = arr.length
      const kn0 = i / binCount
      const kn1 = (i + 1) / binCount

      const k0 = kn0 * kNyquist
      const k1 = kn1 * kNyquist

      // 注意：波数越大，波长越小，所以顺序反过来
      const lambda0 = k1 > 0 ? ((2 * Math.PI) / k1).toFixed(1) : '∞'
      const lambda1 = k0 > 0 ? ((2 * Math.PI) / k0).toFixed(1) : '∞'

      console.log(
        `[${kn0.toFixed(2)} ~ ${kn1.toFixed(2)}] | ` +
          `[${k0.toFixed(3)} ~ ${k1.toFixed(3)}] | ` +
          `[${lambda1} ~ ${lambda0}] | ` +
          `density=${(v * 100).toFixed(2)}% | ` +
          `energy=${((report.radialBins[i]! / report.totalEnergy) * 100).toFixed(2)}%`
      )
    })

    console.log('')
    console.log('======= DIRECTIONAL DISTRIBUTION ========')

    report.directionalNormalized.forEach((v, i, arr) => {
      const length = arr.length
      const range = 360 / length

      console.log(`${i}(${i * range}° ~ ${(i + 1) * range}°): ${(v * 100).toFixed(2)}%`)
    })

    console.log('')
  }

  // ==================== report graph ====================
  public drawLogLogSpectrum(report: SpectrumReport, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const data = report.radialNormalized
    const n = data.length

    const eps = 1e-8

    const logK: number[] = []
    const logE: number[] = []

    // 👉 构造 log(k) 和 log(E)
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n // normalized k (0~1)
      const e = data[i]!

      logK.push(Math.log(k + eps))
      logE.push(Math.log(e + eps))
    }

    // 找范围
    const minX = Math.min(...logK)
    const maxX = Math.max(...logK)
    const minY = Math.min(...logE)
    const maxY = Math.max(...logE)

    // 映射函数
    const mapX = (x: number) => ((x - minX) / (maxX - minX)) * W
    const mapY = (y: number) => H - ((y - minY) / (maxY - minY)) * H

    // 坐标轴（可选）
    ctx.strokeStyle = '#ccc'
    ctx.beginPath()
    ctx.moveTo(0, H - 1)
    ctx.lineTo(W, H - 1)
    ctx.moveTo(1, 0)
    ctx.lineTo(1, H)
    ctx.stroke()

    // 👉 画曲线
    ctx.strokeStyle = 'black'
    ctx.beginPath()

    for (let i = 0; i < n; i++) {
      const x = mapX(logK[i]!)
      const y = mapY(logE[i]!)

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    ctx.stroke()
  }
}
