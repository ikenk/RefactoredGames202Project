import { ComplexBuffer } from '../ComplexBuffer'

/**
 * 频域谱数据（ComplexBuffer 版本）
 */
export interface OceanSpectrumBuffers {
  height: ComplexBuffer
  dispX: ComplexBuffer
  dispZ: ComplexBuffer
  slopeX: ComplexBuffer
  slopeZ: ComplexBuffer
  dDx_dx: ComplexBuffer
  dDz_dz: ComplexBuffer
  dDx_dz: ComplexBuffer
  dDz_dx: ComplexBuffer
}
