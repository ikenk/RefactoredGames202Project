import { ComplexBuffer } from './ComplexBuffer'
import { InitialSpectrum } from './InitialSpectrum'
import { NyquistCorrector } from './NyquistCorrector'
import { OceanParams } from './types/OceanParams'
import { OceanSpectrumBuffers } from './types/OceanSpectrumBuffers'

/**
 * 每帧实时频谱计算
 *
 * - toTextureData() 可直接上传 GPU，省去 uploadComplexMatrix 中的展平步骤
 *
 * @example
 * 菲利普频谱的频域高度场演化公式：
 * h_tilde(k_vec, t) = h0(k_vec) * exp(i * omega(k) * t) + conj(h0(-k_vec)) * exp(-i * omega(k) * t)
 * 其中：
 * - h0_star 表示 h0 的共轭复数（conj(h0)）
 * - k 是波矢 k_vec 的模长（即 |k_vec|）
 * - omega(k) = sqrt(g * k) 是重力波的色散关系
 * - g 为重力加速度
 * - h0(k_vec) = (1/sqrt(2)) * (xi_r + i*xi_i) * sqrt(P_h(k_vec))
 * - xi_r, xi_i 是独立随机实数（通常来自标准正态分布）
 * - P_h(k_vec) 是菲利普功率谱函数
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

    // 预分配全部 9 个 buffer
    this.out = {
      height: new ComplexBuffer(this.N),
      dispX: new ComplexBuffer(this.N),
      dispZ: new ComplexBuffer(this.N),
      slopeX: new ComplexBuffer(this.N),
      slopeZ: new ComplexBuffer(this.N),
      dDx_dx: new ComplexBuffer(this.N),
      dDz_dz: new ComplexBuffer(this.N),
      dDx_dz: new ComplexBuffer(this.N),
      dDz_dx: new ComplexBuffer(this.N)
    }
  }

  generateAtTime(time: number): OceanSpectrumBuffers {
    const { N, gravity, h0, h0Conj, out } = this
    const { height, dispX, dispZ, slopeX, slopeZ, dDx_dx, dDz_dz, dDx_dz, dDz_dx } = out

    for (let n = 0; n < N; n++) {
      for (let m = 0; m < N; m++) {
        const kx = this.waveNumber(n)
        const kz = this.waveNumber(m)
        const k = Math.sqrt(kx * kx + kz * kz)

        // ---- 时域演化 h(k,t) ----
        const omega = Math.sqrt(gravity * k)
        const cosWt = Math.cos(omega * time)
        const sinWt = Math.sin(omega * time)

        const h0r = h0.getReal(n, m)
        const h0i = h0.getImag(n, m)
        const hcr = h0Conj.getReal(n, m)
        const hci = h0Conj.getImag(n, m)

        const hr = h0r * cosWt - h0i * sinWt + (hcr * cosWt + hci * sinWt)
        const hi = h0r * sinWt + h0i * cosWt + (-hcr * sinWt + hci * cosWt)

        if (k > 0.0001 && k <= 10000) {
          const kxn = kx / k
          const kzn = kz / k

          // 位移谱（未缩放）
          // const dxr = -hi * kxn * choppiness
          // const dxi = hr * kxn * choppiness
          // const dzr = -hi * kzn * choppiness
          // const dzi = hr * kzn* choppiness
          // 不要在频域中 * choppiness，这应该是空域的事情
          const dxr = -hi * kxn
          const dxi = hr * kxn
          const dzr = -hi * kzn
          const dzi = hr * kzn

          // Jacobian 谱（从未缩放位移推导）
          // dDx_dx.set(n, m, dxi * kx, -dxr * kx)
          // dDz_dz.set(n, m, dzi * kz, -dzr * kz)
          // dDx_dz.set(n, m, dxi * kz, -dxr * kz)
          // dDz_dx.set(n, m, dzi * kx, -dzr * kx)
          dDx_dx.set(n, m, -dxi * kx, dxr * kx)
          dDz_dz.set(n, m, -dzi * kz, dzr * kz)
          dDx_dz.set(n, m, -dxi * kz, dxr * kz) // = dDz_dx，可以只存一份
          // dDz_dx.set(n, m, -dzi * kx, dzr * kx)

          // 位移谱（缩放 amplitude）
          dispX.set(n, m, dxr, dxi)
          dispZ.set(n, m, dzr, dzi)

          // 梯度谱（不缩放）
          slopeX.set(n, m, -hi * kx, hr * kx)
          slopeZ.set(n, m, -hi * kz, hr * kz)
        } else {
          dispX.set(n, m, 0, 0)
          dispZ.set(n, m, 0, 0)
          slopeX.set(n, m, 0, 0)
          slopeZ.set(n, m, 0, 0)
          dDx_dx.set(n, m, 0, 0)
          dDz_dz.set(n, m, 0, 0)
          dDx_dz.set(n, m, 0, 0)
          dDz_dx.set(n, m, 0, 0)
        }

        // 高度谱（缩放 amplitude）
        height.set(n, m, hr, hi)
      }
    }

    NyquistCorrector.apply(out, N)
    return out
  }

  private waveNumber(index: number): number {
    const n = index < this.N / 2 ? index : index - this.N
    return (2 * Math.PI * n) / this.L
  }
}
