import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { RenderPass } from '../types/RenderPass'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { HUDEntry } from '../types/OverlayPass'

export class OverlayRenderPass implements RenderPass {
  public readonly name = 'OverlayPass'

  // light visualizer 列表（从 WebGLRenderer.lights 传入引用）
  private lightVisualizers: Map<string, MeshRenderer> = new Map()

  // HUD 列表（从 WebGLRenderer.hudRenderers 传入引用）
  private hudEntries: HUDEntry[] = []

  constructor() {
    // hudEntries: typeof OverlayPass.prototype.hudEntries // lightVisualizers: Map<string, MeshRenderer>,
    // this.lightVisualizers = lightVisualizers
    // this.hudEntries = hudEntries
  }

  addLightVisualizer(id: string, viz: MeshRenderer): void {
    this.lightVisualizers.set(id, viz)
  }

  removeLightVisualizer(id: string): void {
    this.lightVisualizers.delete(id)
  }

  addHUDEntry(hudEntry: HUDEntry): void {
    this.hudEntries.push(hudEntry)
  }

  execute(context: FrameContext, camera: PerspectiveCamera): void {
    // ========== Pass 4: Draw light visualizers ==========
    for (const lightViz of this.lightVisualizers.values()) {
      lightViz.draw(context, null, camera)
    }

    // ========== Pass 5: HUD pass（最后渲染，覆盖在场景之上） ==========
    for (const hud of this.hudEntries) {
      hud.renderer.renderAsHUD(
        camera,
        context,
        hud.position, // 左下角，距离边缘5%
        hud.size // HUD区域120x120像素
      )
    }
  }

  dispose(): void {}
}
