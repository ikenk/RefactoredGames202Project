import { SceneContext } from '../../types/SceneContext'
import { UniformType } from '@/materials/types/Material'
import { SKYBOX_SKY_09_CUBEMAP } from '@/scenes/environment/skybox/_config/skyboxSceneConfig'
import { createSkyboxRenderer } from '@/scenes/environment/skybox/deprecated/createSkyboxRenderer'

import { FFTOceanConfig } from './types/FFTOceanConfig-MultiLayers'
import { DEFAULT_FFT_OCEAN_CONFIG } from './_config/fftOceanSceneConfig-MultiLayers'
import { createFFTOceanRenderer } from '@/renderers/factories/water/fftOcean/createFFTOceanRenderer-MultiLayers'
import { FFTOceanComputePass } from '@/renderers/passes/fft/FFTOceanComputePass-multi-layers-v2'
import { ForwardRenderPass } from '@/renderers/passes/forward/ForwardRenderPass'
import { LightSystem } from '@/lights/LightSystem'
import { duskSun } from '@/lights/directionalLight/_presets/sun'
import { JONSWAPSpectrum } from '@/simulation/ocean/spectrums/JONSWAPSpectrum'

export async function loadFFTOceanScene(ctx: SceneContext) {
  const { gl, renderer, camera, controls } = ctx

  // 相机
  camera.position.set(5, 2, 5)
  // camera.position.set(0, 160, 0)
  camera.far = 3000
  camera.updateProjectionMatrix()
  controls.target.set(0, 0, 0)
  controls.maxDistance = 3000

  const lightId = 'duskSun'
  const light = duskSun
  const lightSystem = new LightSystem(gl)
  await lightSystem.addLight(lightId, light)

  // 加载 FFT Ocean 配置
  const fftOceanConfig: FFTOceanConfig = DEFAULT_FFT_OCEAN_CONFIG
  const { oceanParamsCascade } = fftOceanConfig

  // 创建 skybox
  const skyboxConfig = SKYBOX_SKY_09_CUBEMAP
  const skyboxRenderer = await createSkyboxRenderer(gl, skyboxConfig)

  const fftOceanRenderer = await createFFTOceanRenderer(gl, fftOceanConfig)
  fftOceanRenderer.updateMaterialUniforms({
    uEnvironmentMap: {
      type: UniformType.TEXTURE_CUBE,
      value: skyboxRenderer.material.getUniformValue('uSkyboxMap') as WebGLTexture
    }
  })

  const spectrum = new JONSWAPSpectrum()

  const computePass = await FFTOceanComputePass.create(gl, oceanParamsCascade, spectrum)
  computePass.addReceiver(fftOceanRenderer)

  const forwardRenderPass = new ForwardRenderPass(lightSystem)
  forwardRenderPass.addTargetRenderer(skyboxRenderer)
  forwardRenderPass.addTargetRenderer(fftOceanRenderer)

  renderer.addRenderPass(computePass)
  renderer.addRenderPass(forwardRenderPass)
}
