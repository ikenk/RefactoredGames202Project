import { BaseRenderer } from '@/renderers/BaseRenderer'
import { PerspectiveCamera } from 'three'
import { RenderPass } from '../types/RenderPass'
import { FrameContext } from '@/renderers/types/FrameContext'
import { GBufferFBO } from '@/framebuffers/GBufferFBO'

/**
 * GBuffer 渲染 Pass
 *
 * 将场景几何信息渲染到 5-attachment G-Buffer：
 * Diffuse, Depth, Normal, Shadow, WorldPosition
 *
 * 目标 renderer 必须使用 GBufferMaterial
 */
export class GBufferRenderPass implements RenderPass {
  public readonly name: string = 'GBufferRenderPass'

  private gl: WebGLRenderingContext

  private gBufferFBO: GBufferFBO
  private targetRenderers: BaseRenderer[] = []

  constructor(gl: WebGLRenderingContext, width: number, height: number) {
    this.gl = gl

    this.gBufferFBO = new GBufferFBO(gl, width, height)
  }

  execute(context: FrameContext, camera: PerspectiveCamera): void {
    const gl = this.gl

    this.gBufferFBO.bind()
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // shader 只 use 一次，不是每个 renderer 内部各 use 一次
    // const shader = this.targetRenderers[0]?.shader
    // shader?.use()

    const fbo = this.gBufferFBO.getFBO()
    for (const targetRenderer of this.targetRenderers) {
      // draw() 内部又会 shader.use()，但因为 program 没变，是幂等操作
      // 真正的开销在 mesh.bind()（切换 VBO）和 material.applyUniforms()（切换纹理）
      targetRenderer.draw(context, fbo, camera)
    }

    this.gBufferFBO.unbind(gl.canvas.width, gl.canvas.height)
  }

  addTarget(renderer: BaseRenderer): void {
    this.targetRenderers.push(renderer)
  }

  /** 获取 GBufferFBO（供后续 pass 读取纹理） */
  getGBufferFBO(): GBufferFBO {
    return this.gBufferFBO
  }

  resize(width: number, height: number): void {
    this.gBufferFBO.resize(width, height)
  }

  /**
   * 释放本 pass 持有的 GPU 资源
   *
   * 所有权约定：
   * - GBufferRenderPass 是 deferred 管线的「主 pass」，地位对标 forward 管线的 ForwardRenderPass，
   *   因此由它负责释放 targetRenderers（HW3 的场景没有 ForwardRenderPass，没人接手就会泄漏）
   * - ShadowRenderPass 只是持有同一批 renderer 的引用，不负责释放（见该类的 dispose 注释），
   *   所以这里不会造成重复 dispose
   *
   * 历史问题：
   * - 本方法原先只做 targetRenderers.length = 0，renderer 里的 VBO / VAO / Shader 全部泄漏
   * - 该泄漏曾意外「掩盖」了顶点属性槽位残留的 bug：HW3 的 VBO 没被删除，
   *   槽位 3 才一直指着一块活 buffer，让 HW3 → HW4 看上去正常。
   *   VAO 改造完成后这层依赖已经消失，可以安全释放
   */
  // dispose(): void {
  //   this.gBufferFBO.dispose()
  //   this.targetRenderers.length = 0
  // }
  dispose(): void {
    this.gBufferFBO.dispose()

    for (const targetRenderer of this.targetRenderers) {
      targetRenderer.dispose()
    }
    this.targetRenderers.length = 0
  }
}
