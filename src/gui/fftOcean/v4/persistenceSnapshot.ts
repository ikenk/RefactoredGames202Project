import type { FFTOceanMaterialConfig } from '@/materials/water/types/FFTOceanMaterialConfig'
import type { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers'
import type { FFTOceanLayerAuthoringConfig } from '@/scenes/water/fftOcean/types/FFTOceanLayerAuthoringConfig'
import type { SpectrumModelConfig } from '@/simulation/ocean/spectrums/types/SpectrumModelConfig'

/** localStorage 与内存 preset 共用的嵌套 FFT Ocean 快照。 */
export interface FFTOceanSnapshot {
  readonly materialConfig: FFTOceanMaterialConfig
  readonly layers: FFTOceanLayerAuthoringConfig[]
}

/**
 * 复制当前 GUI live state，生成不再引用原配置的快照。
 */
export function takeFFTOceanSnapshot(config: FFTOceanConfig): FFTOceanSnapshot {
  return {
    materialConfig: copyMaterialConfig(config.materialConfig),
    layers: config.layers.map(copyLayerAuthoringConfig)
  }
}

/**
 * 把快照值写回现有 GUI live state。
 *
 * 相同模型下保留已经被 Tweakpane 绑定的分组对象、choppiness 数组和模型参数对象；
 * 只有模型种类真的改变时才替换整个 `spectrum` 联合成员。
 */
export function applyFFTOceanSnapshot(snapshot: FFTOceanSnapshot, config: FFTOceanConfig): void {
  replaceOwnProperties(config.materialConfig, copyMaterialConfig(snapshot.materialConfig))

  snapshot.layers.forEach((savedLayer, layerIndex) => {
    const targetLayer = config.layers[layerIndex]
    if (!targetLayer) return

    replaceOwnProperties(targetLayer.grid, savedLayer.grid)
    replaceOwnProperties(targetLayer.evaluation, savedLayer.evaluation)
    replaceOwnProperties(targetLayer.initialSpectrum, savedLayer.initialSpectrum)
    replaceRuntimeConfig(targetLayer, savedLayer)
    replaceOwnProperties(targetLayer.blend, savedLayer.blend)
    replaceSpectrumConfig(targetLayer, savedLayer.spectrum)
  })
}

function copyMaterialConfig(config: FFTOceanMaterialConfig): FFTOceanMaterialConfig {
  const copy: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    copy[key] = Array.isArray(value) ? [...value] : value
  }

  return copy as FFTOceanMaterialConfig
}

function copyLayerAuthoringConfig(
  layer: FFTOceanLayerAuthoringConfig
): FFTOceanLayerAuthoringConfig {
  return {
    grid: { ...layer.grid },
    evaluation: { ...layer.evaluation },
    spectrum: copySpectrumModelConfig(layer.spectrum),
    initialSpectrum: { ...layer.initialSpectrum },
    runtime: {
      ...layer.runtime,
      choppiness: [layer.runtime.choppiness[0], layer.runtime.choppiness[1]]
    },
    blend: { ...layer.blend }
  }
}

function copySpectrumModelConfig(config: SpectrumModelConfig): SpectrumModelConfig {
  switch (config.model) {
    case 'jonswap':
      return {
        model: 'jonswap',
        primary: { ...config.primary },
        ...(config.secondary === undefined ? {} : { secondary: { ...config.secondary } })
      }
    case 'phillips':
      return {
        ...config,
        windDirection: { ...config.windDirection }
      }
    case 'capillary':
      return { ...config }
  }
}

function replaceRuntimeConfig(
  targetLayer: FFTOceanLayerAuthoringConfig,
  savedLayer: FFTOceanLayerAuthoringConfig
): void {
  const targetChoppiness = targetLayer.runtime.choppiness
  const savedChoppiness = savedLayer.runtime.choppiness

  replaceOwnProperties(targetLayer.runtime, {
    ...savedLayer.runtime,
    choppiness: targetChoppiness
  })

  targetChoppiness[0] = savedChoppiness[0]
  targetChoppiness[1] = savedChoppiness[1]
}

function replaceSpectrumConfig(
  targetLayer: FFTOceanLayerAuthoringConfig,
  savedSpectrum: SpectrumModelConfig
): void {
  const targetSpectrum = targetLayer.spectrum

  if (targetSpectrum.model !== savedSpectrum.model) {
    targetLayer.spectrum = copySpectrumModelConfig(savedSpectrum)
    return
  }

  switch (targetSpectrum.model) {
    case 'jonswap': {
      if (savedSpectrum.model !== 'jonswap') return

      replaceOwnProperties(targetSpectrum.primary, savedSpectrum.primary)

      if (savedSpectrum.secondary === undefined) {
        delete (targetSpectrum as { secondary?: unknown }).secondary
      } else if (targetSpectrum.secondary === undefined) {
        ;(targetSpectrum as { secondary?: unknown }).secondary = { ...savedSpectrum.secondary }
      } else {
        replaceOwnProperties(targetSpectrum.secondary, savedSpectrum.secondary)
      }
      return
    }

    case 'phillips': {
      if (savedSpectrum.model !== 'phillips') return
      const targetDirection = targetSpectrum.windDirection
      replaceOwnProperties(targetSpectrum, {
        ...savedSpectrum,
        windDirection: targetDirection
      })
      replaceOwnProperties(targetDirection, savedSpectrum.windDirection)
      return
    }

    case 'capillary':
      if (savedSpectrum.model !== 'capillary') return
      replaceOwnProperties(targetSpectrum, savedSpectrum)
  }
}

function replaceOwnProperties(target: object, source: object): void {
  const targetRecord = target as Record<string, unknown>
  const sourceRecord = source as Record<string, unknown>

  for (const key of Object.keys(targetRecord)) {
    if (!(key in sourceRecord)) delete targetRecord[key]
  }

  Object.assign(targetRecord, sourceRecord)
}
