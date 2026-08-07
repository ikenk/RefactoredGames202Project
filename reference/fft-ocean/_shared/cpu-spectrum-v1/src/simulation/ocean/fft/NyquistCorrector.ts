import { ComplexBuffer } from './ComplexBuffer'
import { OceanSpectrumBuffers } from './types/OceanSpectrumBuffers'

/**
 * Nyquist 频率共轭对称性修正（v2 · ComplexBuffer 版本）
 */
export class NyquistCorrector {
  static apply(data: OceanSpectrumBuffers, N: number): void {
    const targets = [data.dispX, data.dispZ, data.slopeX, data.slopeZ]
    const half = N / 2

    for (const buf of targets) {
      for (let m = 0; m < N; m++) {
        NyquistCorrector.enforceConjugate(buf, half, m, half, (N - m) % N)
      }
      for (let n = 0; n < N; n++) {
        NyquistCorrector.enforceConjugate(buf, n, half, (N - n) % N, half)
      }
      for (let m = 0; m < N; m++) {
        NyquistCorrector.enforceConjugate(buf, 0, m, 0, (N - m) % N)
      }
      for (let n = 0; n < N; n++) {
        NyquistCorrector.enforceConjugate(buf, n, 0, (N - n) % N, 0)
      }

      // 四角点强制为实数
      buf.setImag(0, 0, 0)
      buf.setImag(0, half, 0)
      buf.setImag(half, 0, 0)
      buf.setImag(half, half, 0)
    }
  }

  private static enforceConjugate(
    buf: ComplexBuffer,
    n1: number,
    m1: number,
    n2: number,
    m2: number
  ): void {
    if (n1 === n2 && m1 === m2) {
      buf.setImag(n1, m1, 0)
      return
    }

    // ← 全部是 number，无 undefined 报错
    const avgReal = (buf.getReal(n1, m1) + buf.getReal(n2, m2)) / 2
    const avgImag = (buf.getImag(n1, m1) - buf.getImag(n2, m2)) / 2

    buf.set(n1, m1, avgReal, avgImag)
    buf.set(n2, m2, avgReal, -avgImag)
  }
}
