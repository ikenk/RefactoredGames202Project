import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import type { RenderTargetScope } from '@/renderers/types/RenderTargetScope'

// export interface RenderPass {
//   readonly name: string

//   /**
//    * 每帧执行
//    * @param renderers - WebGLRenderer 管理的所有 mesh renderer
//    * @param context   - 帧上下文
//    * @param camera    - 当前相机
//    */
//   // execute(renderers: BaseRenderer[], context: FrameContext, camera: PerspectiveCamera): void
//   execute(context: FrameContext, camera: PerspectiveCamera): void

//   /** 窗口 resize 时调用 */
//   resize?(width: number, height: number): void

//   dispose(): void
// }

export interface RenderPass {
  readonly name: string

  /**
   * 每帧执行一次。
   *
   * @param context 本帧数据；它不包含 framebuffer 控制能力。
   * @param camera 当前相机。
   * @param renderTargets 仅在本次 execute 调用期间借用的 RenderTarget 作用域。
   *
   * 和 three.js 的联系：
   * 输出目标仍由 renderer 统一执行绑定，不由 Mesh/BaseRenderer 决定。
   *
   * 和 three.js 的区别：
   * pass 不保存完整 renderer，也不直接调用公开 setRenderTarget；
   * 它只借用一个可自动恢复的窄作用域。
   */
  execute(context: FrameContext, camera: PerspectiveCamera, renderTargets: RenderTargetScope): void

  /** 窗口 resize 时调用；具体目标仍由拥有它的 pass resize。 */
  resize?(width: number, height: number): void

  /**
   * 释放本 pass 拥有的资源。
   * WebGLRenderer 可以因为自己拥有并移除 pass 而调用此方法；
   * 不能因为某个 RenderTarget 曾被绑定而直接 dispose 该 target。
   */
  dispose(): void
}
