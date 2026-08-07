import { Spectrum } from '../Spectrum'
import { SpectrumModelConfig } from './SpectrumModelConfig'

export type SpectrumFactory = (params: SpectrumModelConfig) => Spectrum

/** 工厂支持的波谱模型。 */
// export type SpectrumModel = 'phillips' | 'jonswap'

/**
 * 创建 SpectrumFactory 时的选项。
 *
 * Phillips 的 A 和逆风衰减属于模型级工程调参，不复用
 * `OceanParams.amplitude`，避免与 InitialSpectrum 的全局缩放重复。
 */
// export type SpectrumFactoryOptions =
//   | {
//       model: 'phillips'
//       amplitude?: number
//       opposingWaveDamping?: number
//     }
//   | {
//       model: 'jonswap'
//     }
