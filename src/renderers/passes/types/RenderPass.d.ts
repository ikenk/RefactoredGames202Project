import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'

export interface RenderPass {
  readonly name: string

  /**
   * 每帧执行
   * @param renderers - WebGLRenderer 管理的所有 mesh renderer
   * @param context   - 帧上下文
   * @param camera    - 当前相机
   */
  // execute(renderers: BaseRenderer[], context: FrameContext, camera: PerspectiveCamera): void
  execute(context: FrameContext, camera: PerspectiveCamera): void

  /** 窗口 resize 时调用 */
  resize?(width: number, height: number): void

  dispose(): void
}
