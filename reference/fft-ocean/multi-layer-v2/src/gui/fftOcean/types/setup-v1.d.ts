import { BaseRenderer } from '@/renderers/BaseRenderer'
import { FFTOceanComputePass } from '@/renderers/passes/fft/FFTOceanComputePass-multi-layers-v2'
import { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers'
import { Spectrum } from '@/simulation/ocean/spectrums/Spectrum'

export interface FFTOceanGUIDeps {
  config: FFTOceanConfig
  oceanRenderer: BaseRenderer
  computePass: FFTOceanComputePass
  spectrum: Spectrum
}
