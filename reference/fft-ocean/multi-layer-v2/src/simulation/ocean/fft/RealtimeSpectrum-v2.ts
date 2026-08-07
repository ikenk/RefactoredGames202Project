import { ComplexBuffer } from './ComplexBuffer'
import { InitialSpectrum } from './InitialSpectrum'
import { OceanParams } from './types/OceanParams'
import { OceanSpectrumBuffers } from './types/OceanSpectrumBuffers-refactor-v2'

/**
 * 实时频谱演化 + 两两打包
 *
 * 打包代数：
 *   若 A = a_r + i·a_i, B = b_r + i·b_i，则
 *   C = A + i·B = (a_r - b_i) + i·(a_i + b_r)
 */
export class RealtimeSpectrum {
  private readonly N: number
  private readonly L: number
  private readonly gravity: number

  private readonly h0: ComplexBuffer
  private readonly h0Conj: ComplexBuffer

  private readonly out: OceanSpectrumBuffers

  constructor(params: OceanParams, initialSpectrum: InitialSpectrum) {
    this.N = params.fftResolution
    this.L = params.size
    this.gravity = params.gravity

    this.h0 = initialSpectrum.getH0()
    this.h0Conj = initialSpectrum.getH0Conj()

    // 4 个 packed buffer
    this.out = {
      pack0: new ComplexBuffer(this.N),
      pack1: new ComplexBuffer(this.N),
      pack2: new ComplexBuffer(this.N),
      pack3: new ComplexBuffer(this.N)
    }
  }

  generateAtTime(time: number): OceanSpectrumBuffers {
    const { N, gravity, h0, h0Conj, out } = this
    const { pack0, pack1, pack2, pack3 } = out

    for (let n = 0; n < N; n++) {
      for (let m = 0; m < N; m++) {
        // kx 对应 Texture Y 轴，kz 对应 Texture X 轴（详见 Debug-Claude.md）
        // const kx = this.waveNumber(n)
        // const kz = this.waveNumber(m)

        // kx 对应 Texture X 轴，kz 对应 Texture Y 轴（详见 Debug-Claude.md）
        const kx = this.waveNumber(m)
        const kz = this.waveNumber(n)

        const k = Math.sqrt(kx * kx + kz * kz)

        // ---- h(k,t) = h0·e^{iωt} + conj(h0(-k))·e^{-iωt} ----
        const omega = Math.sqrt(gravity * k)
        const cosWt = Math.cos(omega * time)
        const sinWt = Math.sin(omega * time)

        const h0r = h0.getReal(n, m)
        const h0i = h0.getImag(n, m)
        const hcr = h0Conj.getReal(n, m)
        const hci = h0Conj.getImag(n, m)

        const hr = h0r * cosWt - h0i * sinWt + (hcr * cosWt + hci * sinWt)
        const hi = h0r * sinWt + h0i * cosWt + (-hcr * sinWt + hci * cosWt)

        // ---- 8 个基础复数信号（频域）----
        const heightR = hr,
          heightI = hi
        let dxR = 0,
          dxI = 0,
          dzR = 0,
          dzI = 0
        let slopeXR = 0,
          slopeXI = 0,
          slopeZR = 0,
          slopeZI = 0
        let dDxdxR = 0,
          dDxdxI = 0,
          dDzdzR = 0,
          dDzdzI = 0
        let dDzdxR = 0,
          dDzdxI = 0

        if (k > 0.0001 && k < 10000) {
          const kxn = kx / k
          const kzn = kz / k

          // 位移谱 dispX = -i·h·k.x/|k| = (hi·kxn) - i·(hr·kxn)
          // dxR = hi * kxn
          // dxI = -hr * kxn
          // dzR = hi * kzn
          // dzI = -hr * kzn
          dxR = -hi * kxn // 原: hi * kxn
          dxI = hr * kxn // 原: -hr * kxn
          dzR = -hi * kzn // 原: hi * kzn
          dzI = hr * kzn // 原: -hr * kzn

          // 梯度谱 slope = i·h·k → slopeX = -hi·kx + i·hr·kx
          slopeXR = -hi * kx
          slopeXI = hr * kx
          slopeZR = -hi * kz
          slopeZI = hr * kz

          // Jacobian 对角 ∂Dx/∂x = i·k.x·dispX = (-dxI·kx) + i·(dxR·kx)
          dDxdxR = -dxI * kx
          dDxdxI = dxR * kx
          dDzdzR = -dzI * kz
          dDzdzI = dzR * kz
          // 非对角 ∂Dz/∂x = ∂Dx/∂z = i·k.x·dispZ = (-dzI·kx) + i·(dzR·kx)
          dDzdxR = -dzI * kx
          dDzdxI = dzR * kx
        }

        // ==================== 打包 C = A + i·B ====================
        // pack0 = height + i·dDz_dx
        pack0.set(n, m, heightR - dDzdxI, heightI + dDzdxR)

        // pack1 = dispX + i·dispZ
        pack1.set(n, m, dxR - dzI, dxI + dzR)

        // pack2 = slopeX + i·slopeZ
        pack2.set(n, m, slopeXR - slopeZI, slopeXI + slopeZR)

        // pack3 = dDx_dx + i·dDz_dz
        pack3.set(n, m, dDxdxR - dDzdzI, dDxdxI + dDzdzR)
      }
    }

    return out
  }

  private waveNumber(index: number): number {
    const n = index < this.N / 2 ? index : index - this.N
    return (2 * Math.PI * n) / this.L
  }
}
