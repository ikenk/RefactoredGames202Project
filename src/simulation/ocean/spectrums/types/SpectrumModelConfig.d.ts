import type { CapillarySpectrumConfig } from './CapillarySpectrumConfig'
import type { JONSWAPSpectrumConfig } from './JONSWAPSpectrumConfig'
import type { PhillipsSpectrumConfig } from './PhillipsSpectrumConfig'

/** 一层 JONSWAP 波谱的模型配置。 */
export type JONSWAPSpectrumModelConfig = Readonly<JONSWAPSpectrumConfig> & {
  readonly model: 'jonswap'
}

/** 一层 Phillips 波谱的模型配置。 */
export type PhillipsSpectrumModelConfig = Readonly<PhillipsSpectrumConfig> & {
  readonly model: 'phillips'
}

/** 一层毛细波谱的模型配置。 */
export type CapillarySpectrumModelConfig = Readonly<CapillarySpectrumConfig> & {
  readonly model: 'capillary'
}

/** 所有波谱模型配置组成的可辨识联合。 */
export type SpectrumModelConfig =
  | JONSWAPSpectrumModelConfig
  | PhillipsSpectrumModelConfig
  | CapillarySpectrumModelConfig
