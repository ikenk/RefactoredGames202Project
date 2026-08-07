import type { FFTOceanLayerBlendConfig } from './types/FFTOceanLayerBlendConfig'

/**
 * 复制并裁剪 FFT Ocean 每层的材质混合配置。
 *
 * 输入可以是包含额外字段的旧层配置，但输出不会继续携带频谱、FFT 或 foam 参数。
 */
export function createFFTOceanLayerBlendConfigs(
  layers: readonly FFTOceanLayerBlendConfig[]
): FFTOceanLayerBlendConfig[] {
  return layers.map(({ layerContribute }) =>
    layerContribute === undefined ? {} : { layerContribute }
  )
}
