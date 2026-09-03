import { LightSystem } from '@/lights/LightSystem'
import { ShadowMapFBO } from '@/framebuffers/ShadowMapFBO'
import { BaseRenderer } from '../../BaseRenderer'
import { Uniforms, UniformType } from '@/materials/types/Material'
import { DirectionalLight } from '@/lights/directionalLight/DirectionalLight-refactor'
import { ILight } from '@/lights/types/light'
import { RenderPass } from '../types/RenderPass'
import { ShadowPass } from './ShadowPass'
import { IShadowCaster, ShadowRenderDefaults } from './types/shadow'
import { DEFAULT_SHADOW_RENDER } from './_config/defaultConfig'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { LightNotFoundError } from '@/errors/EngineError/LightError/LightNotFoundError'
import { RenderTargetScope } from '@/renderers/types/RenderTargetScope'

/**
 * Shadow Render Pass
 *
 * 职责：
 * 1. 管理 ShadowMapFBO 和底层 ShadowPass 的生命周期
 * 2. 执行 shadow pass（每帧，在 main pass 之前）
 * 3. 推送 shadow uniform 到 receiveShadow 的 renderer
 *
 * 不负责：
 * - 光源数据管理（从 LightSystem 查询）
 * - 光照 uniform 推送（由 LightSystem 负责）
 */
export class ShadowRenderPass implements RenderPass {
  public readonly name = 'ShadowRenderPass'

  private gl: WebGLRenderingContext
  private lightSystem: LightSystem // 只读查询，不修改

  // ============================================================
  //  Shadow 相关
  //  当前设计：仅支持单个 shadow caster light
  //  扩展多光源阴影时需要将以下三个成员改为 Map<string, ShadowEntry>
  // ============================================================
  private shadowCasterLightId: string | null = null
  private shadowMapFBO: ShadowMapFBO | null = null
  private shadowPass: ShadowPass | null = null

  // 持有 WebGLRenderer 中 Set 的引用，
  // 避免每帧都需执行的 execute() 函数中的
  // const shadowCasters = renderers.filter((r) => r.castShadow)
  // 和
  // for (const renderer of renderers) { if (renderer.receiveShadow) this.applyPerFrameUniforms(renderer) }
  // 造成的性能损耗
  private readonly casters: Set<BaseRenderer> = new Set()
  private readonly receivers: Set<BaseRenderer> = new Set()

  constructor(
    gl: WebGLRenderingContext,
    lightSystem: LightSystem
    // casters: Set<BaseRenderer>, // 引用
    // receivers: Set<BaseRenderer> // 引用
  ) {
    this.gl = gl
    this.lightSystem = lightSystem
    // this.casters = casters
    // this.receivers = receivers
  }

  // ============================================================
  // initialize
  // ============================================================
  // =============== 单光源 ===============
  async initRenderPass(
    lightId: string
    // light: IShadowCaster
  ): Promise<void> {
    const light = this.lightSystem.getLight(lightId)
    if (!light || !this.isShadowCaster(light)) {
      throw new LightNotFoundError(lightId)
    }

    if (this.shadowPass) {
      console.warn('[ShadowRenderPass] Shadow pass already initialized, skipping')
      return
    }

    const gl = this.gl
    const resolution = light.shadowResolution

    // 1. ShadowMapFBO 先创建（内部检测扩展）
    this.shadowMapFBO = new ShadowMapFBO(gl, resolution)

    // 2. ShadowPass 从 ShadowMapFBO 获取 useDepthTexture
    this.shadowPass = await ShadowPass.create(gl, this.shadowMapFBO)

    // 3. 记录关联的 light id
    this.shadowCasterLightId = lightId
  }

  // ============================================================
  //  初始化：推送光源参数
  // ============================================================

  /**
   * 初始化时设置一次（shadow pass 创建后调用）
   * 只对 receiveShadow 的 renderer 调用
   */
  applyStaticUniforms(
    renderer: BaseRenderer,
    defaults: ShadowRenderDefaults = DEFAULT_SHADOW_RENDER
  ): void {
    if (!this.shadowMapFBO || !this.shadowCasterLightId) return // 只检查自己内部成员的状态

    const shadowLight = this.lightSystem.getLight(this.shadowCasterLightId)
    if (!shadowLight || !this.isShadowCaster(shadowLight)) return

    const uniforms: Uniforms = {}

    const type = shadowLight.type

    switch (type) {
      case 'directional': {
        const light = shadowLight as DirectionalLight
        const config = light.shadowConfig

        // 生命周期内不变
        uniforms['uUseDepthTexture'] = {
          type: UniformType.ONE_I,
          value: this.shadowMapFBO.useDepthTexture ? 1 : 0
        }
        uniforms['uShadowMapSize'] = {
          type: UniformType.ONE_F,
          value: light.shadowResolution
        }
        uniforms['uFrustumSize'] = {
          type: UniformType.ONE_F,
          value: config.orthoSize * 2
        }
        uniforms['uLightNearPlane'] = {
          type: UniformType.ONE_F,
          value: config.near
        }
        // 光源属性，GUI 可调
        uniforms['uLightWorldSize'] = {
          type: UniformType.ONE_F,
          value: light.worldSize
        }
        // 用户偏好（初始默认值），GUI 可调
        uniforms['uShadowMethod'] = {
          type: UniformType.ONE_I,
          value: defaults.method
        }
        uniforms['uFilterRadius'] = {
          type: UniformType.ONE_F,
          value: defaults.filterRadius
        }

        break
      }
      case 'point': {
        // TODO: 点光源用 cube shadow map
        // const pointLight = shadowLight as IPointLight
        // lightUniforms['uShadowCubeMap'] = ...
        // lightUniforms['uLightCubeVPs'] = pointLight.getCubeViewProjectionMatrices()
        break
      }
      case 'spot': {
        // TODO: 点光源用 cube shadow map
        break
      }
      default: {
        console.warn(`[LightSystem] Shadow not implemented for light type: ${type}`)
      }
    }

    renderer.updateMaterialUniforms(uniforms)
  }

  // ============================================================
  //  Per-Frame Uniform：每帧推送
  // ============================================================

  /**
   * 推送阴影参数到单个渲染器（每帧调用）
   *
   * 推送内容：uLightVP, uShadowMap
   * 仅对 receiveShadow === true 的 renderer 调用（由外部过滤）
   *
   * 静态阴影参数（uUseDepthTexture）由 applyStaticShadowUniforms 在 addLight 时一次性设置
   */
  private applyPerFrameUniforms(renderer: BaseRenderer): void {
    if (!this.shadowMapFBO || !this.shadowCasterLightId) return

    const shadowLight = this.lightSystem.getLight(this.shadowCasterLightId)
    if (!shadowLight) return

    const uniforms: Uniforms = {}

    const type = shadowLight.type
    switch (type) {
      case 'directional': {
        const light = shadowLight as DirectionalLight
        const config = light.shadowConfig

        // 在 shadowMapFBO 的声明周期中都不会改变的 uniform，放到 applyStaticShadowUniforms 中实现
        // lightUniforms['uUseDepthTexture'] = this.shadowMapFBO.useDepthTexture

        uniforms['uShadowMap'] = {
          type: UniformType.TEXTURE_2D,
          value: this.shadowMapFBO.getShadowMapTexture()
        }
        uniforms['uLightVP'] = {
          type: UniformType.MATRIX_4FV,
          value: light.getViewProjectionMatrix()
        }
        uniforms['uShadowMapSize'] = {
          type: UniformType.ONE_F,
          value: light.shadowResolution
        }
        uniforms['uFrustumSize'] = {
          type: UniformType.ONE_F,
          value: config.orthoSize * 2
        }
        uniforms['uLightNearPlane'] = {
          type: UniformType.ONE_F,
          value: config.near
        }
        uniforms['uLightWorldSize'] = {
          type: UniformType.ONE_F,
          value: light.worldSize
        }
        break
      }
      case 'point': {
        // TODO: 点光源用 cube shadow map
        // const pointLight = shadowLight as IPointLight
        // lightUniforms['uShadowCubeMap'] = ...
        // lightUniforms['uLightCubeVPs'] = pointLight.getCubeViewProjectionMatrices()
        break
      }
      case 'spot': {
        // TODO: 点光源用 cube shadow map
        break
      }
      default: {
        console.warn(`[LightSystem] Shadow not implemented for light type: ${type}`)
      }
    }

    renderer.updateMaterialUniforms(uniforms)
  }

  // ============================================================
  //  execute：每帧由 WebGLRenderer 调用
  // ============================================================

  /**
   * 执行 shadow pass（在 main pass 之前调用）
   * 从场景中
   * @param shadowCasters - castShadow === true 的渲染器（由调用方过滤）
   */
  execute(_context: FrameContext, _camera: PerspectiveCamera, renderTargets: RenderTargetScope) {
    if (!this.shadowPass || !this.shadowCasterLightId) return

    const shadowLight = this.lightSystem.getLight(this.shadowCasterLightId)
    if (!shadowLight) return

    // 1. 执行 shadow pass（渲染深度到 FBO）
    // 保存当前 viewport 状态
    const savedViewport = this.gl.getParameter(this.gl.VIEWPORT) as Int32Array
    const vpX = savedViewport[0] ?? 0
    const vpY = savedViewport[1] ?? 0
    const vpW = savedViewport[2] ?? this.gl.canvas.width
    const vpH = savedViewport[3] ?? this.gl.canvas.height

    // const shadowCasters = renderers.filter((r) => r.castShadow)

    switch (shadowLight.type) {
      case 'directional':
        this.shadowPass.drawDirectionalLight(shadowLight as DirectionalLight, this.casters)
        break
      case 'point':
        // TODO: this.shadowPass.executePointLight(light as IPointLight, shadowCasters)
        break
      case 'spot':
        // TODO: this.shadowPass.executeSpotLight(light as IPointLight, shadowCasters)
        break
      default:
        console.warn(`[LightSystem] Shadow not supported for light type: ${shadowLight.type}`)
    }

    // 恢复 viewport（framebuffer 的解绑由 ShadowPass 内部的 unbind 负责）
    this.gl.viewport(vpX, vpY, vpW, vpH)

    // 2. 推送 per-frame shadow uniform 到所有 receiveShadow 的 renderer
    for (const renderer of this.receivers) {
      this.applyPerFrameUniforms(renderer)
    }
  }

  // ============================================================
  //  管理 casters & receivers
  // ============================================================

  addCaster(caster: MeshRenderer) {
    if (!caster.castShadow) return // 防御性编程
    this.casters.add(caster)
  }

  addReceiver(receiver: MeshRenderer) {
    if (!receiver.castShadow) return // 防御性编程
    this.receivers.add(receiver)
  }

  getAllCasters(): Set<BaseRenderer> {
    return this.casters
  }

  getAllReceiver(): Set<BaseRenderer> {
    return this.receivers
  }

  // ============================================================
  //  辅助函数
  // ============================================================

  /**
   * 判断 light 是否具有投射阴影的能力
   *
   * 实现：
   * 类型守卫：是否实现了 IShadowCaster
   */
  private isShadowCaster(light: ILight): light is ILight & IShadowCaster {
    return 'castShadow' in light && 'shadowResolution' in light
  }

  /** shadow pass 是否已就绪 */
  get isReady(): boolean {
    return (
      this.shadowMapFBO !== null && this.shadowPass !== null && this.shadowCasterLightId !== null
    )
  }

  // ============================================================
  //  Getter
  // ============================================================

  getShadowPass(): ShadowPass | null {
    return this.shadowPass
  }

  // ============================================================
  //  清理
  // ============================================================
  // dispose(): void {
  //   this.shadowPass?.dispose()
  //   this.shadowMapFBO?.dispose()
  //   this.shadowPass = null
  //   this.shadowMapFBO = null
  //   this.shadowCasterLightId = null
  // }
  /**
   * 释放本 pass 自己创建的 GPU 资源
   *
   * 👉 所有权约定：
   * - shadowPass / shadowMapFBO 由本类创建 → 由本类释放
   * - casters / receivers 只是**外部 renderer 的引用**，本类没有创建它们，因此不释放，
   *   只清空集合以断开引用（避免场景切换后仍持有已销毁对象）
   * - 真正的释放方：forward 管线由 ForwardRenderPass 负责，deferred 管线由 GBufferRenderPass 负责
   *
   * ❗ 不要在这里 dispose renderer：
   * - HW1 的 renderer 同时在 ShadowRenderPass 和 ForwardRenderPass 里，两边都释放会造成重复 dispose
   */
  dispose(): void {
    this.shadowPass?.dispose()
    this.shadowMapFBO?.dispose()
    this.shadowPass = null
    this.shadowMapFBO = null
    this.shadowCasterLightId = null

    this.casters.clear()
    this.receivers.clear()
  }
}
