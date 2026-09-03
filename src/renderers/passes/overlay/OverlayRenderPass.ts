import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { RenderPass } from '../types/RenderPass'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { HUDEntry } from '../types/OverlayPass'
import type { RenderTargetScope } from '@/renderers/types/RenderTargetScope'

export class OverlayRenderPass implements RenderPass {
  public readonly name = 'OverlayPass'

  /**
   * 当前仍由 WebGLRenderer 的专用 Overlay 通道持有。
   * 第一阶段不把它迁移到 RenderStage + lifetime 注册模型。
   */
  private lightVisualizers: Map<string, MeshRenderer> = new Map()
  private hudEntries: HUDEntry[] = []

  addLightVisualizer(id: string, viz: MeshRenderer): void {
    this.lightVisualizers.set(id, viz)
  }

  removeLightVisualizer(id: string): void {
    this.lightVisualizers.delete(id)
  }

  addHUDEntry(hudEntry: HUDEntry): void {
    this.hudEntries.push(hudEntry)
  }

  /**
   * _renderTargets 只用于满足统一的 RenderPass 契约。
   * Overlay 当前不主动切换 RenderTarget，因为 WebGLRenderer.render()
   * 已在外层建立默认 framebuffer 作用域。
   *
   * 和 three.js 的联系：
   * three.js 的 WebGLRenderer 也在 renderer 层确定整体渲染顺序和目标，
   * 单个 Mesh 不接收 framebuffer 参数。
   *
   * 和 three.js 的区别：
   * 当前项目把 light visualizer 与 HUD 放进显式 OverlayRenderPass；
   * three.js 核心 renderer 没有完全相同的 OverlayPass 公共抽象。
   */
  execute(
    context: FrameContext,
    camera: PerspectiveCamera,
    _renderTargets: RenderTargetScope
  ): void {
    for (const lightViz of this.lightVisualizers.values()) {
      lightViz.draw(context, camera)
    }

    for (const hud of this.hudEntries) {
      hud.renderer.renderAsHUD(camera, context, hud.position, hud.size)
    }
  }

  dispose(): void {}
}
