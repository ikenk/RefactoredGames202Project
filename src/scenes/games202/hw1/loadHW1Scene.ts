import { SceneContext } from '../../types/SceneContext'
import { HW1_SCENE_CONFIG } from './_config/hw1SceneConfig'
import { loadOBJ } from '@/loaders/loadOBJ'
import { createMeshRendererFromOBJ } from '@/renderers/factories/meshRendererFromModel/fromOBJ/createMeshRendererFromOBJ'
import { setupLightGUI } from '@/gui/light/setup'
import { setupShadowGUI } from '@/gui/shadow/setup'

import { UniformType } from '@/materials/types/Material'
import { DEFAULT_SHADOW_RENDER } from '@/renderers/passes/shadow/_config/defaultConfig'
import { LightSystem } from '@/lights/LightSystem'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { ShadowRenderPass } from '@/renderers/passes/shadow/ShadowRenderPass'
import { ForwardRenderPass } from '@/renderers/passes/forward/ForwardRenderPass'
import { GUI } from 'dat.gui'
import { mountDatGUI, unmountDatGUI } from '@/gui/_shared/mountGUI'

/** 加载 HW1 完整场景：Mary + Floor */
export async function loadHW1Scene(ctx: SceneContext): Promise<() => void> {
  const { gl, renderer, camera, controls } = ctx

  const config = HW1_SCENE_CONFIG // 加载场景配置
  const { cameraConfig, modelConfigs, lightConfigs } = config

  // 相机
  camera.position.set(...cameraConfig.position)
  controls.target.set(...cameraConfig.target)

  const gui = mountDatGUI()
  const folders: GUI[] = []

  // ========== 1. 光源 ==========
  const lightSystem = new LightSystem(gl)
  if (lightConfigs) {
    for (const lightConfig of lightConfigs) {
      await lightSystem.addLight(lightConfig.id, lightConfig.light)
    }
  }

  // ========== 2. 模型 ==========
  const meshRenderers: MeshRenderer[] = []
  for (const modelConfig of modelConfigs) {
    // 1. 加载纯数据
    const meshDataArr = await loadOBJ(modelConfig.path, modelConfig.name, modelConfig.transform)

    //     console.log(`[function loadHW1Scene] meshDataArr.length: ${meshDataArr.length}`)

    // 2. 数据 → MeshRenderer → 注册到 renderer
    for (let i = 0; i < meshDataArr.length; i++) {
      const data = meshDataArr[i]
      const meshRenderer = await createMeshRendererFromOBJ(gl, {
        data: data!,
        vertShaderPath: modelConfig.vertShaderPath,
        fragShaderPath: modelConfig.fragShaderPath,
        extraUniforms: modelConfig.extraUniforms,
        rendererName: `${modelConfig.name} ${i}`
      })
      meshRenderer.castShadow = true
      meshRenderer.receiveShadow = true
      meshRenderers.push(meshRenderer)
    }
  }

  if (lightConfigs) {
    for (const lightConfig of lightConfigs) {
      if (lightConfig.guiConfig) {
        //         console.debug('[function loadHW1Scene] setupLightGUI has run.')
        const folder = setupLightGUI(gui, lightConfig.light, lightConfig.guiConfig, (worldSize) => {
          // worldSize 变了 → 同步到对应的 visualizer
          const visualizer = lightSystem.getVisualizer(lightConfig.id)
          visualizer?.mesh.setScale(worldSize / 2, worldSize / 2, worldSize / 2)
          // worldSize 变了 → 同步到所有 receiveShadow 的 renderer
          for (const meshRenderer of meshRenderers) {
            if (!meshRenderer.receiveShadow) continue
            meshRenderer.updateMaterialUniforms({
              uLightWorldSize: { type: UniformType.ONE_F, value: worldSize }
            })
          }
        })
        folders.push(folder)
      }
    }
  }

  // ========== 3. Shadow Pass ==========
  const shadowLightId = lightSystem.getPrimaryShadowCasterId()
  if (shadowLightId) {
    const shadowRenderPass = new ShadowRenderPass(gl, lightSystem)
    await shadowRenderPass.initRenderPass(shadowLightId)
    for (const meshRenderer of meshRenderers) {
      if (meshRenderer.castShadow) shadowRenderPass.addCaster(meshRenderer)
      if (meshRenderer.receiveShadow) shadowRenderPass.addReceiver(meshRenderer)
    }
    renderer.addRenderPass(shadowRenderPass)

    // 阴影 GUI
    const folder = setupShadowGUI(gui, () => meshRenderers, {
      name: 'HW1 Shadow',
      defaultMethod: DEFAULT_SHADOW_RENDER.method,
      defaultFilterRadius: DEFAULT_SHADOW_RENDER.filterRadius
    })
    folders.push(folder)
  }

  // ========== 4. Forward Pass ==========
  const forwardPass = new ForwardRenderPass(lightSystem)
  for (const meshRenderer of meshRenderers) {
    forwardPass.addTargetRenderer(meshRenderer)
  }
  renderer.addRenderPass(forwardPass)

  // ========== 5. Overlay —— 光源 visualizer ==========
  const overlayPass = renderer.getOverlayRenderPass()
  if (overlayPass) {
    for (const [id, viz] of lightSystem.getVisualizers()) {
      overlayPass.addLightVisualizer(id, viz)
    }
  }

  return () => {
    // 1. 先撤销往 overlay 中添加的 visualizer（副作用对称撤销）
    const overlayPass = renderer.getOverlayRenderPass()
    if (overlayPass) {
      for (const [id] of lightSystem.getVisualizers()) {
        overlayPass.removeLightVisualizer(id)
      }
    }
    // 2. 再 dispose 自己的资源
    lightSystem.dispose()
    // HW1 没有手动创建的纹理，模型纹理都是 factory 自动生成的 1x1 fallback
    // 它们跟着 MeshRenderer → Mesh 的 dispose 走
    // 但 MeshRenderer 的 dispose 目前不清理 Material 里的纹理
    // 所以这些 1x1 纹理会泄漏——但它们很小，可以接受
    unmountDatGUI(gui)
  }
}
