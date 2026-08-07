import { SceneContext } from '../../types/SceneContext'
import { UniformType } from '@/materials/types/Material'
import { SKYBOX_KLOOFENDAL_43D_CLEAR_PURESKY_2K_EXR } from '@/scenes/environment/skybox/_config/skyboxSceneConfig'
// import { createSkyboxRenderer } from '@/scenes/environment/skybox/createSkyboxRenderer'
import { createSkyboxRenderer } from '@/scenes/environment/skybox/createSkyboxRenderer'

import { FFTOceanConfig } from './types/FFTOceanConfig-MultiLayers'
import { DEFAULT_FFT_OCEAN_CONFIG } from './_config/fftOceanSceneConfig-MultiLayers'
import { createFFTOceanRenderer } from '@/renderers/factories/water/fftOcean/createFFTOceanRenderer-MultiLayers'
import { FFTOceanComputePass } from '@/renderers/passes/fft/FFTOceanComputePass-multi-layers-v2'
import { ForwardRenderPass } from '@/renderers/passes/forward/ForwardRenderPass'
import { LightSystem } from '@/lights/LightSystem'
import { noonSun } from '@/lights/directionalLight/_presets/sun'
import { JONSWAPSpectrum } from '@/simulation/ocean/spectrums/JONSWAPSpectrum'
import { linearizeCubemap } from '@/textures/cubemap/linearizeCubemap'
import { setupFFTOceanGUI } from '@/gui/fftOcean/v1/setup'
import { SpectrumAnalyzer } from '@/simulation/ocean/analysis/SpectrumAnalyzer'
import { prefilterEnvironment } from '@/textures/cubemap/IBL/prefilterEnvironment'
import { generateBRDFLUT } from '@/textures/cubemap/IBL/generateBRDFLUT'
import { GUI } from 'dat.gui'

export async function loadFFTOceanScene(ctx: SceneContext) {
  const { gl, renderer, camera, controls } = ctx

  // 相机
  camera.position.set(30, 5, -10)
  // camera.position.set(60, 5, 80)
  // camera.position.set(0, 350, 0)
  camera.far = 3000
  camera.updateProjectionMatrix()
  controls.target.set(0, 0, 0)
  controls.maxDistance = 3000

  const lightId = 'noonSun'
  const light = noonSun
  const lightSystem = new LightSystem(gl)
  await lightSystem.addLight(lightId, light)

  // 加载 FFT Ocean 配置
  const fftOceanConfig: FFTOceanConfig = DEFAULT_FFT_OCEAN_CONFIG
  const { oceanParamsCascade } = fftOceanConfig

  // 创建 skybox
  const skyboxConfig = SKYBOX_KLOOFENDAL_43D_CLEAR_PURESKY_2K_EXR
  // const skyboxRenderer = await createSkyboxRenderer(gl, skyboxConfig)
  const { renderer: skyboxRenderer, cubemap, isSRGB } = await createSkyboxRenderer(gl, skyboxConfig)

  // ---------- IBL：split-sum specular ----------
  // 输出 hdr 的线性 cubemap
  const linearCubemap = await linearizeCubemap(gl, cubemap, {
    resolution: skyboxConfig.resolution, // linearizeCubemap 中的 cubemap 的 resolution，和 loadCubemapFromHDR 中的 cubemap 的 resolution 并没有直接联系
    isSRGB
  })
  // 把 linearized envmap 用 GGX 卷积成"按 roughness 分 mip"的 prefiltered cubemap
  // mip 0..4 对应 roughness 0/0.25/0.5/0.75/1.0
  const prefilteredEnvMap = await prefilterEnvironment(gl, linearCubemap, {
    baseResolution: 256,
    numMips: 5,
    sampleCount: 1024
  })
  // 生成与 envmap、材质都无关的 BRDF LUT（2D 纹理）
  // horizontal: NdotV ∈ [0, 1]，vertical: roughness ∈ [0, 1]
  // 输出 RG = (scale, bias)，配合 F₀ 还原镜面反射
  const brdfLUT = await generateBRDFLUT(gl, {
    resolution: 256,
    sampleCount: 1024
  })

  const fftOceanRenderer = await createFFTOceanRenderer(gl, fftOceanConfig)
  fftOceanRenderer.updateMaterialUniforms({
    uEnvironmentMap: {
      type: UniformType.TEXTURE_CUBE,
      value: linearCubemap
    }
  })
  // 把两张纹理 + max mip 传给 ocean material
  fftOceanRenderer.updateMaterialUniforms({
    uPrefilteredEnvMap: { type: UniformType.TEXTURE_CUBE, value: prefilteredEnvMap },
    uBRDFLUT: { type: UniformType.TEXTURE_2D, value: brdfLUT },
    uMaxReflectionLod: { type: UniformType.ONE_F, value: 4.0 } // = numMips - 1
  })

  const spectrum = new JONSWAPSpectrum()
  const spectrumAnalyzer = new SpectrumAnalyzer(spectrum)
  let index = 0
  for (const oceanParam of oceanParamsCascade) {
    const report = spectrumAnalyzer.analyze(oceanParam)
    spectrumAnalyzer.printReport(report, oceanParam)
    index++
    // spectrumAnalyzer.drawLogLogSpectrum(report, gl.canvas as HTMLCanvasElement)
  }
  const computePass = await FFTOceanComputePass.create(gl, oceanParamsCascade, spectrum)
  computePass.addReceiver(fftOceanRenderer)

  const forwardRenderPass = new ForwardRenderPass(lightSystem)
  forwardRenderPass.addTargetRenderer(skyboxRenderer)
  forwardRenderPass.addTargetRenderer(fftOceanRenderer)
  renderer.addRenderPass(computePass)
  renderer.addRenderPass(forwardRenderPass)

  const gui = new GUI()
  setupFFTOceanGUI(gui, {
    config: fftOceanConfig,
    oceanRenderer: fftOceanRenderer,
    computePass,
    spectrum
  })
}
