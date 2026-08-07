import { ComplexBuffer } from '../ComplexBuffer'

/**
 * Packed 频谱缓冲（9 信号 → 4 packed buffer）
 *
 * 打包规则（C(k) = A(k) + i·B(k)，IFFT 后 Re = IFFT[A], Im = IFFT[B]）：
 *   pack0 = height   + i·(∂Dz/∂x)      → (Dy, ∂Dz/∂x = ∂Dx/∂z)
 *   pack1 = dispX    + i·dispZ         → (Dx, Dz)
 *   pack2 = slopeX   + i·slopeZ        → (∂Dy/∂x, ∂Dy/∂z)
 *   pack3 = ∂Dx/∂x   + i·∂Dz/∂z        → Jacobian 对角
 */
export interface OceanSpectrumBuffers {
  pack0: ComplexBuffer // height + i·dDz_dx
  pack1: ComplexBuffer // dispX  + i·dispZ
  pack2: ComplexBuffer // slopeX + i·slopeZ
  pack3: ComplexBuffer // dDx_dx + i·dDz_dz
}
