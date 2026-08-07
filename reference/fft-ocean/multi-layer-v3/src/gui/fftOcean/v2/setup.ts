import { GUI } from 'dat.gui'
import { UniformType } from '@/materials/types/Material'
import { FFTOceanGUIDeps } from '../types/setup-v2'

/**
 * 简易 debounce：高频调用合并到尾部一次
 */
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export function setupFFTOceanGUI(gui: GUI, deps: FFTOceanGUIDeps): GUI {
  const { config, oceanRenderer, computePass, spectrum } = deps
  const folder = gui.addFolder('FFT Ocean')

  // ==================== 全局材质参数（热）====================
  const matFolder = folder.addFolder('Material')
  const mat = config.materialConfig

  matFolder
    .add(mat, 'normalStrength', 0, 5, 0.05)
    .name('normal strength')
    .onChange((v: number) =>
      oceanRenderer.updateMaterialUniforms({
        uNormalStrength: { type: UniformType.ONE_F, value: v }
      })
    )

  matFolder
    .add(mat, 'heightStrength', 0, 3, 0.05)
    .name('height strength')
    .onChange((v: number) =>
      oceanRenderer.updateMaterialUniforms({
        uHeightStrength: { type: UniformType.ONE_F, value: v }
      })
    )

  matFolder.open()

  // ==================== 每层参数 ====================
  config.oceanParamsCascade.forEach((layer, i) => {
    const layerFolder = folder.addFolder(`Layer ${i}  (size=${layer.size})`)

    // ---- 冷参数 debounce 重建 ----
    const rebuild = debounce(() => {
      computePass.rebuildLayerSpectrum(i, layer, spectrum)
    }, 200)

    // ---- 热参数：layerContribute ----
    layerFolder
      .add(layer, 'layerContribute', 0, 1.5, 0.05)
      .name('layer contribute')
      .onChange((v: number) =>
        oceanRenderer.updateMaterialUniforms({
          [`uLayerContribute${i}`]: { type: UniformType.ONE_F, value: v }
        })
      )

    // ---- 热参数：choppiness X / Z ----
    // dat.gui 的数组成员通过字符串索引访问：'0' / '1'
    const choppy = layer.choppiness ?? [1.0, 1.0]
    layer.choppiness = choppy
    layerFolder
      .add(choppy, '0', 0, 5, 0.1)
      .name('chop X')
      .onChange((v: number) => {
        choppy[0] = v
        computePass.setLayerChoppiness(i, choppy)
      })
    layerFolder
      .add(choppy, '1', 0, 5, 0.1)
      .name('chop Z')
      .onChange((v: number) => {
        choppy[1] = v
        computePass.setLayerChoppiness(i, choppy)
      })

    // ---- 冷参数：amplitude ----
    layerFolder.add(layer, 'amplitude', 0, 2, 0.05).name('amplitude').onChange(rebuild)

    // ---- 冷参数：spectrum0 / spectrum1 windDirection ----
    if (layer.spectrum0) {
      layerFolder
        .add(layer.spectrum0, 'windDirection', 0, 360, 1)
        .name('wind dir 0')
        .onChange(rebuild)
    }
    if (layer.spectrum1) {
      layerFolder
        .add(layer.spectrum1, 'windDirection', 0, 360, 1)
        .name('wind dir 1')
        .onChange(rebuild)
    }

    // 默认打开第 0 层，其他折叠
    if (i === 0) layerFolder.open()
  })

  // folder.open()
  return folder
}
