import { LightSystem } from '@/lights/LightSystem'
import { RenderPass } from '../types/RenderPass'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { LineRenderer } from '@/renderers/LineRenderer'
import { UniformType } from '@/materials/types/Material'
import type { RenderTargetScope } from '@/renderers/types/RenderTargetScope'

export class ForwardRenderPass implements RenderPass {
  public readonly name = 'ForwardRenderPass'

  private lineRenderers: BaseRenderer[] = []
  private meshRenderers: BaseRenderer[] = []

  private lightSystem: LightSystem | null

  constructor(lightSystem?: LightSystem) {
    this.lightSystem = lightSystem ?? null
  }

  // execute(context: FrameContext, camera: PerspectiveCamera): void {
  //   for (const lineRenderer of this.lineRenderers) {
  //     lineRenderer.draw(context, null, camera)
  //   }
  //   for (const meshRenderer of this.meshRenderers) {
  //     // 推送光源参数（光照方向、shadow map 等）
  //     this.lightSystem?.applyPerFrameLightUniforms(meshRenderer)
  //     if ('uCameraPos' in meshRenderer.material.uniforms) {
  //       // 推送相机位置（PBR shader 需要 uCameraPos 计算视线方向）
  //       meshRenderer.updateMaterialUniforms({
  //         uCameraPos: {
  //           type: UniformType.THREE_FV,
  //           value: camera.position.toArray()
  //         }
  //       })
  //     }
  //     if ('uTime' in meshRenderer.material.uniforms) {
  //       meshRenderer.updateMaterialUniforms({
  //         uTime: {
  //           type: UniformType.ONE_F,
  //           value: context.elapsedTime
  //         }
  //       })
  //     }

  //     meshRenderer.draw(context, null, camera)
  //   }
  // }

  // ============================================================
  //  Renderer 管理
  // ============================================================

  execute(
    context: FrameContext,
    camera: PerspectiveCamera,
    _renderTargets: RenderTargetScope
  ): void {
    for (const lineRenderer of this.lineRenderers) {
      lineRenderer.draw(context, camera)
    }

    for (const meshRenderer of this.meshRenderers) {
      // 这里保留现有的光源、uCameraPos 和 uTime 更新逻辑。
      // 唯一与本次小责任相关的变化是 draw 不再接收 null FBO。
      this.lightSystem?.applyPerFrameLightUniforms(meshRenderer)

      if ('uCameraPos' in meshRenderer.material.uniforms) {
        meshRenderer.updateMaterialUniforms({
          uCameraPos: {
            type: UniformType.THREE_FV,
            value: camera.position.toArray()
          }
        })
      }

      if ('uTime' in meshRenderer.material.uniforms) {
        meshRenderer.updateMaterialUniforms({
          uTime: {
            type: UniformType.ONE_F,
            value: context.elapsedTime
          }
        })
      }

      meshRenderer.draw(context, camera)
    }
  }

  addTargetRenderer(renderer: BaseRenderer) {
    if (renderer instanceof MeshRenderer) {
      this.meshRenderers.push(renderer)
    }

    if (renderer instanceof LineRenderer) {
      this.lineRenderers.push(renderer)
    }
  }
  deleteTargetRenderer(renderer: BaseRenderer) {
    if (renderer instanceof MeshRenderer) {
      const index = this.meshRenderers.indexOf(renderer)
      if (index === -1) return
      this.meshRenderers.splice(index, 1)
    }
    if (renderer instanceof LineRenderer) {
      const index = this.lineRenderers.indexOf(renderer)
      if (index === -1) return
      this.lineRenderers.splice(index, 1)
    }
  }

  dispose(): void {
    for (const lineRenderer of this.lineRenderers) {
      lineRenderer.dispose()
    }
    for (const meshRenderer of this.meshRenderers) {
      meshRenderer.dispose()
    }
    this.lineRenderers.length = 0
    this.meshRenderers.length = 0
  }
}
