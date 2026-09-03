import type { RenderTarget } from './RenderTarget'

/**
 * RenderTarget 作用域中的命令 callback。
 *
 * 返回类型使用 undefined，而不是 void：
 * - 可以在 TypeScript 编译阶段拒绝直接传入 async 函数；
 * - 可以拒绝直接返回 Promise 的箭头函数；
 * - 不依赖 ESLint 才能发现上述两种误用。
 *
 * 这个类型不能阻止 callback 内部启动异步任务，例如：
 *
 * void startAsyncWork()
 *
 * 因此还必须遵守运行时契约：
 * 所有依赖当前 framebuffer/viewport 的命令，都必须在 callback
 * 返回之前同步完成。异步 continuation 不得继续使用该目标作用域。
 */
export type SynchronousRenderTargetCallback = () => undefined

export interface RenderTargetScope {
  /**
   * 临时绑定 target，执行 callback，然后恢复进入前的真实状态。
   *
   * target === null 表示默认 framebuffer。
   *
   * callback 正常返回或同步抛错时，都会通过 finally 恢复状态。
   * callback 不得直接返回 Promise，也不得安排依赖当前绑定状态的异步绘制。
   *
   * 本方法只借用 target，不取得其所有权，也不负责 dispose。
   */
  withRenderTarget(target: RenderTarget | null, callback: SynchronousRenderTargetCallback): void
}
