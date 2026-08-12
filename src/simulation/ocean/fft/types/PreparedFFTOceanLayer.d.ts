import type { InitialSpectrum } from '../InitialSpectrum'
import type { FFTOceanLayerRuntimeConfig } from './FFTOceanLayerRuntimeConfig'
import type { FFTSpectrumEvolutionConfig } from './FFTSpectrumEvolutionConfig'

/**
 * 已在 ComputePass 外部完成的单层 CPU 输入。
 *
 * `initialSpectrum` 已经包含 h0(k) 与 h0*(-k)；ComputePass 只负责把它上传到
 * GPU，并创建该层的实时频谱、IFFT 与最终输出资源。
 *
 * 该对象只携带 ComputePass 真正需要的初始频谱、演化配置和运行时配置。
 */
export interface PreparedFFTOceanLayer {
  readonly initialSpectrum: InitialSpectrum
  readonly evolutionConfig: FFTSpectrumEvolutionConfig
  readonly runtimeConfig: FFTOceanLayerRuntimeConfig
}
