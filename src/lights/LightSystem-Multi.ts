import { MeshRenderer } from '@/renderers/MeshRenderer'
import { ILight } from './types/light'
import { createLightVisualizer } from './visualizers/createLightVisualizer'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { IDirectionalLight } from './directionalLight/types/directionalLight'
import { IPointLight } from './pointLight/types/pointLight'
import { Uniforms, UniformType } from '@/materials/types/Material'
import { IShadowCaster } from '@/renderers/passes/shadow/types/shadow'

/**
 * 场景级光源管理系统
 *
 * 职责：
 * 1. 管理所有光源数据
 * 2. 每帧重新计算光源参数（VP 矩阵、方向等）
 * 3. 将光源 uniform 推送给所有需要光照的场景渲染器
 * 4. 管理 Shadow Map FBO
 *
 * 不负责：
 * - 光源可视化渲染（由 createLightVisualizer 工厂函数负责）
 * - 具体的渲染管线（由 WebGLRenderer 负责）
 */
export class LightSystem {
  private gl: WebGLRenderingContext

  // 场景中的光源视觉效果，不提供光源参数
  private visualizers: Map<string, MeshRenderer> = new Map()

  // 场景中的光源参数，不提供光源视觉效果
  private lights: Map<string, ILight> = new Map()

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  // ============================================================
  //  光源管理
  // ============================================================

  /** 添加光源 */
  async addLight(id: string, light: ILight): Promise<MeshRenderer> {
    if (this.lights.has(id)) {
      console.warn(`[LightSystem] Light "${id}" already exists, skipping`)
      return this.visualizers.get(id)!
    }

    this.lights.set(id, light)

    // =============== 多光源 ===============

    // 创建对应的 gizmo
    const visualizer = await createLightVisualizer(this.gl, light)
    this.visualizers.set(id, visualizer)

    return visualizer
  }

  /** 删除光源 */
  removeLight(id: string): MeshRenderer | undefined {
    // 清理 lights
    if (!this.lights.has(id)) {
      console.warn(`[LightSystem] Light "${id}" not found, skipping`)
      return undefined
    }

    this.lights.delete(id)

    // =============== 多光源 ===============

    // 清理 gizmo
    const visualizer = this.visualizers.get(id)
    this.visualizers.delete(id)

    return visualizer
  }

  /** 获取指定光源 */
  getLight(id: string): ILight | undefined {
    return this.lights.get(id)
  }

  /**
   * 注入光照相关的 uniform 声明到 renderer 的 material 中（upsert）
   *
   * 注入内容：uLightPos, uLightDir, uLightRadiance
   * 初始值为占位（全零），由 applyPerFrameLightUniforms 每帧覆盖
   *
   * 在 WebGLRenderer.addRenderer 时自动调用，
   * 使得 scene config 中无需手动声明光照 uniform
   */
  injectLightUniforms(_renderer: BaseRenderer): void {
    throw new Error('NOT IMPLEMENTED')
  }

  // ============================================================
  //  初始化：推送光源参数
  // ============================================================

  // ============================================================
  //  每帧：推送光源参数给场景
  // ============================================================

  /**
   * 推送光照参数到单个渲染器（每帧调用）
   *
   * 推送内容：uLightRadiance, uLightPos, uLightDir 等
   * 不包含阴影相关 uniform（由 applyPerFrameShadowUniforms 负责）
   */
  applyPerFrameLightUniforms(renderer: BaseRenderer) {
    const primaryLight = this.getPrimaryLight()
    if (!primaryLight) {
      // console.debug('[LightSystem] No primary light found, skipping')
      return
    }

    const uniforms: Uniforms = {
      uLightRadiance: { type: UniformType.THREE_FV, value: primaryLight.radiance }
    }

    switch (primaryLight.type) {
      case 'directional':
        {
          const light = primaryLight as IDirectionalLight
          uniforms['uLightDir'] = { type: UniformType.THREE_FV, value: light.direction }
          uniforms['uLightPos'] = { type: UniformType.THREE_FV, value: light.position }
        }
        break
      case 'point': {
        // TODO: 点光源参数
        const light = primaryLight as IPointLight
        uniforms['uLightPos'] = { type: UniformType.THREE_FV, value: light.position }
        break
      }
      case 'spot': {
        break
      }
      default:
        console.warn(`[LightSystem] Unsupported light type for uniform push: ${primaryLight.type}`)
    }

    renderer.updateMaterialUniforms(uniforms)
  }

  // ============================================================
  //  每帧：推送“假”光源参数（暂时被舍弃）
  // ============================================================

  // updateVisualizers() {
  //   for (const [id, light] of this.lights) {
  //     const viz = this.visualizers.get(id)
  //     if (!viz) continue

  //     // visualizer 是一个小方块 gizmo，它的 material 只有 uLightColor 这一个 uniform
  //     // 它不接收光照、不投射阴影，不需要 uLightDir、uLightPos 这些 uniform。

  //     // 1. 位置：通过 mesh 的 transform 同步（attribute 层面）
  //     viz.mesh.setTranslation(light.position[0], light.position[1], light.position[2])

  //     // 2. 颜色：通过 material uniform 同步
  //     viz.updateMaterialUniforms({
  //       uLightColor: light.radiance
  //     })
  //   }
  // }

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

  /**
   * 获取主方向光（当前只支持单光源照明）
   * 未来多光源时改为循环
   */
  private getPrimaryLight(): ILight | undefined {
    for (const light of this.lights.values()) {
      if (light.type === 'directional') return light
    }
    return undefined
  }

  // ============================================================
  //  Getter
  // ============================================================

  // ============================================================
  //  清理
  // ============================================================
  dispose(): void {
    // 释放 visualizers
    for (const visualizer of this.visualizers.values()) {
      visualizer.dispose()
    }

    // 清空引用
    this.lights.clear()
    this.visualizers.clear()
  }
}
