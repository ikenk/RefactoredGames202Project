import { createFFTOceanRenderer } from '@/renderers/factories/water/fftOcean/createFFTOceanRenderer'
import { DEFAULT_FFT_OCEAN_CONFIG } from './_config/fftOceanSceneConfig'
import { SceneContext } from '../../types/SceneContext'
import { ForwardRenderPass } from '@/renderers/passes/forward/ForwardRenderPass'
import { FFTOceanComputePass } from '@/renderers/passes/fft/FFTOceanComputePass-single-layer'
import { PhillipsSpectrum } from '@/simulation/ocean/spectrums/PhillipsSpectrum'
import { FFTOceanConfig } from './types/FFTOceanConfig'
import { createSkyboxRenderer } from '@/scenes/environment/skybox/deprecated/createSkyboxRenderer'
import {
  SKYBOX_SKY_09_CUBEMAP,
  SKYBOX_SKY_18_CUBEMAP,
  SKYBOX_SKY_SUNSET_CUBEMAP
} from '@/scenes/environment/skybox/_config/skyboxSceneConfig'
import { UniformType } from '@/materials/types/Material'

export async function loadFFTOceanScene(ctx: SceneContext) {
  const { gl, renderer, camera, controls } = ctx

  // 相机
  camera.position.set(30, 60, 200)
  camera.far = 3000
  camera.updateProjectionMatrix()
  controls.target.set(0, 0, 0)
  controls.maxDistance = 3000

  // 加载 FFT Ocean 配置
  const fftOceanConfig: FFTOceanConfig = DEFAULT_FFT_OCEAN_CONFIG
  const { oceanParams } = fftOceanConfig

  // 创建 skybox
  const skyboxConfig = SKYBOX_SKY_09_CUBEMAP
  const skyboxRenderer = await createSkyboxRenderer(gl, skyboxConfig)

  // const { renderer: fftOceanRenderer } = await createFFTOceanRenderer(gl, fftOceanConfig)
  const fftOceanRenderer = await createFFTOceanRenderer(gl, fftOceanConfig)
  fftOceanRenderer.updateMaterialUniforms({
    uEnvironmentMap: {
      type: UniformType.TEXTURE_CUBE,
      value: skyboxRenderer.material.getUniformValue('uSkyboxMap') as WebGLTexture
    }
  })

  const spectrum = new PhillipsSpectrum()

  const computePass = await FFTOceanComputePass.create(gl, oceanParams, spectrum)
  computePass.addReceiver(fftOceanRenderer)

  const forwardRenderPass = new ForwardRenderPass()
  forwardRenderPass.addTargetRenderer(skyboxRenderer)
  forwardRenderPass.addTargetRenderer(fftOceanRenderer)

  renderer.addRenderPass(computePass)
  renderer.addRenderPass(forwardRenderPass)
}
