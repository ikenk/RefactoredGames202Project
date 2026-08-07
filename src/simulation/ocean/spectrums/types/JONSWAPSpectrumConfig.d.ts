import { SpectrumSettings } from './SpectrumSettings'

export interface JONSWAPSpectrumConfig {
  /** 主子谱，一般用于主要风浪。 */
  readonly primary: SpectrumSettings

  /** 次子谱，可用于交叉风浪或涌浪。 */
  readonly secondary?: SpectrumSettings
}
