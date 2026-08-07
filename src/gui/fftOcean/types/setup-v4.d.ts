import { BaseRenderer } from '@/renderers/BaseRenderer'
import { FFTOceanComputePass } from '@/renderers/passes/fft/FFTOceanComputePass-multi-layers-v3'
import { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers'
// import { Spectrum } from '@/simulation/ocean/spectrums/Spectrum'

/**
 * 由 Scene 负责完成 Spectrum 创建、InitialSpectrum 生成和 ComputePass 更新。
 */
export type RebuildLayerSpectrum = (layerIndex: number) => void

/**
 * FFT Ocean GUI v4 的 deps 类型（基于 Tweakpane）
 *
 * 与 v3（dat.GUI）的区别仅在 GUI 句柄类型；其他依赖完全一致。
 * pane 由 Engine 在 init 阶段创建并通过 SceneContext 传入。
 */
export interface FFTOceanGUIDeps {
  config: FFTOceanConfig
  oceanRenderer: BaseRenderer
  computePass: FFTOceanComputePass
  // spectrum: Spectrum
  rebuildLayerSpectrum: RebuildLayerSpectrum
}
