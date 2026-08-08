import { loadGLTF } from '@/loaders/loadGLTF'
import { CAVE_SCENE_CONFIG_GBUFFER } from './_config/caveSceneConfig'
import { setupLightGUI } from '@/gui/light/setup'
import { createGBufferRendererFromGLTF } from '@/renderers/factories/deferred/fromGLTF/createGBufferRendererFromGLTF'
import { GBufferRenderPass } from '@/renderers/passes/deferred/GBufferRenderPass'
import { DepthMipmapPass } from '@/renderers/passes/deferred/DepthMipmapPass'
import { SSRRenderPass } from '@/renderers/passes/deferred/SSRRenderPass'
import { DirectionalLight } from '@/lights/directionalLight/DirectionalLight-refactor'
import { ConfigValidationError } from '@/errors/EngineError/ConfigurationError/ConfigValidationError'
import { LightSystem } from '@/lights/LightSystem'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { ShadowRenderPass } from '@/renderers/passes/shadow/ShadowRenderPass'
import { LightNotFoundError } from '@/errors/EngineError/LightError/LightNotFoundError'
import { SceneContext } from '@/scenes/types/SceneContext'
import { GUI } from 'dat.gui'
import { mountDatGUI, unmountDatGUI } from '@/gui/_shared/mountGUI'

/**
 * 把 GLTFMeshData（纯数据）转换为 GPU 资源（Mesh + Texture），
 * 并注册到 renderer。
 *
 * 这是 scenes/ 的核心职责：
 * loaders/ 返回纯数据 → scenes/ 负责创建 GPU 资源并组装
 */

/** Cave 场景加载函数 */
export async function loadHW3Scene(ctx: SceneContext) {
  const { gl, renderer, camera, controls } = ctx
  // const config = CAVE_SCENE_CONFIG_DIRECTIONAL_LIGHT
  const config = CAVE_SCENE_CONFIG_GBUFFER
  const { cameraConfig, modelConfigs, lightConfigs } = config

  // 相机
  camera.position.set(...cameraConfig.position)
  controls.target.set(...cameraConfig.target)

  const gui = mountDatGUI()
  const folders: GUI[] = []

  // ============================================================
  //  Pass 1: Shadow（通过 addLight 自动初始化）
  // ============================================================
  const lightSystem = new LightSystem(gl)
  if (lightConfigs && lightConfigs.length > 0) {
    for (const lightConfig of lightConfigs) {
      // await renderer.addLight(lightConfig.id, lightConfig.light)
      await lightSystem.addLight(lightConfig.id, lightConfig.light)
      if (lightConfig.guiConfig) {
        const folder = setupLightGUI(gui, lightConfig.light, lightConfig.guiConfig)
        folders.push(folder)
        //         console.debug('[function loadHW3Scene] setupLightGUI has run.')
      }
    }
  } else {
    throw new ConfigValidationError('CAVE_SCENE_CONFIG', [
      'lightConfigs is required for deferred pipeline (shadow data needed)'
    ])
  }

  // ============================================================
  //  加载模型
  // ============================================================
  const meshRenderers: MeshRenderer[] = []
  for (const modelConfig of modelConfigs) {
    // 1. 加载纯数据
    const meshDataArr = await loadGLTF(modelConfig.path, modelConfig.name, modelConfig.transform)

    //     console.log(`[function loadHW3Scene] meshDataArr.length: ${meshDataArr.length}`)

    // 2. 数据 → MeshRenderer → 注册到 renderer
    for (let i = 0; i < meshDataArr.length; i++) {
      // for (let i = 0; i < 6; i++) {
      const meshRenderer = await createGBufferRendererFromGLTF(gl, {
        data: meshDataArr[i]!,
        rendererName: `${modelConfig.name}#${i}`
        // 不需要传 shader 路径——GBuffer shader 固定
        // 不需要传 extraUniforms——shadow uniform 由 ShadowRenderPass 自动推送
      })
      meshRenderer.castShadow = true
      meshRenderer.receiveShadow = true
      // renderer.addRenderer(meshRenderer)
      meshRenderers.push(meshRenderer)
    }
  }

  // ============================================================
  //  Pass 2: Shadow Pass
  // ============================================================
  const shadowLightId = lightSystem.getPrimaryShadowCasterId()
  if (!shadowLightId) throw new LightNotFoundError('[PrimaryShadowCaster]')
  const shadowRenderPass = new ShadowRenderPass(gl, lightSystem)
  await shadowRenderPass.initRenderPass(shadowLightId)
  for (const meshRenderer of meshRenderers) {
    if (meshRenderer.castShadow) shadowRenderPass.addCaster(meshRenderer)
    if (meshRenderer.receiveShadow) shadowRenderPass.addReceiver(meshRenderer)
  }
  renderer.addRenderPass(shadowRenderPass)

  // ============================================================
  //  Pass 3: GBuffer Pass
  // ============================================================
  const width = gl.canvas.width
  const height = gl.canvas.height

  const gBufferPass = new GBufferRenderPass(gl, width, height)
  for (const shadowReceiver of shadowRenderPass.getAllReceiver()) {
    gBufferPass.addTarget(shadowReceiver)
  }
  // ============================================================
  //  Pass 4: Depth Mipmap
  // ============================================================
  // 从 GBuffer 的 depth attachment 逐级生成 min-reduction 深度金字塔
  // SSR 的 Hi-Z ray march 会用到（当前版本用线性步进，后续升级时启用）
  const depthMipmapPass = await DepthMipmapPass.create(
    gl,
    gBufferPass.getGBufferFBO(),
    width,
    height
  )

  // ============================================================
  //  Pass 4: SSR
  // ============================================================
  // 全屏后处理：读 GBuffer 5 张纹理，做 ray march，输出最终画面到屏幕
  const ssrPass = await SSRRenderPass.create(
    gl,
    gBufferPass.getGBufferFBO(),
    depthMipmapPass.getDepthMipmapFBO()
  )

  // 设置光照参数给 SSR shader
  // SSR Pass 没有 Material，光照参数必须手动传入
  if (lightConfigs && lightConfigs.length > 0) {
    const light = lightConfigs[0]!.light as DirectionalLight
    // light.direction 是"光源 → 场景"的方向
    // SSR shader 的 uLightDir 需要的也是这个方向
    // （shader 内部 normalize 后直接用于 dot(normal, lightDir)）
    const dir = light.shadingDirection
    ssrPass.updateLightParams(dir, light.radiance)
  }

  // ============================================================
  //  注册 Pass（顺序 = 执行顺序）
  // ============================================================
  // ShadowRenderPass 已经由 addLight 自动注册到 renderPasses[0]
  // 这里只需要注册 deferred pipeline 的 3 个 pass
  //
  // 执行顺序：
  //   renderPasses[0] = ShadowRenderPass（addLight 时自动加的）
  //     → 渲染 shadow map
  //     → 对所有 receiver 推送 uShadowMap / uLightVP
  //   renderPasses[1] = GBufferRenderPass
  //     → 遍历 targetRenderer，draw 到 GBufferFBO
  //     → 此时 renderer 的 material 里已经有 shadow uniform（被 ShadowRenderPass 设好了）
  //     → GBuffer fragment shader 用 uShadowMap 做 PCSS，结果写入 attachment[3]
  //   renderPasses[2] = DepthMipmapPass
  //     → 从 GBufferFBO 的 depth 纹理生成 Hi-Z 金字塔
  //   renderPasses[3] = SSRRenderPass
  //     → 读 GBuffer 5 张纹理 + depth mipmap
  //     → 直接光照 + ray march 间接光照
  //     → 输出到屏幕
  renderer.addRenderPass(gBufferPass)
  // renderer.addRenderPass(depthMipmapPass)
  renderer.addRenderPass(ssrPass)

  return () => {
    // GBufferFBO、DepthMipmapFBO 等由对应 RenderPass.dispose() 清理
    lightSystem.dispose()
    unmountDatGUI(gui)
  }
}
