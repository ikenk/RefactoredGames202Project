import {
  ResourceDisposedError,
  ResourceHasSceneReferencesError,
  ResourceSceneReferenceUnderflowError
} from './errors'

/**
 * Resource 开始真正释放时同步调用的监听器。
 *
 * @remarks
 * WebGL1 ResourceManager 用它删除当前 context 自己持有的 GPU 表示。Scene 引用数减少但
 * 仍然大于零时不会调用 listener；只有最后一个引用消失或无引用资源被直接 dispose 时
 * 才会通知。
 */
export type DisposeListener = () => void

/**
 * 所有 CPU 逻辑渲染资源共享的生命周期基类。
 *
 * @remarks
 * `Resource` 不持有 WebGL context 或 GPU handle。它只负责一次性释放状态、同步通知
 * 各 context 的 Manager，并在通知结束后让具体子类释放自己的 CPU 数据。
 *
 * 抽象成员要求每个具体子类说明稳定的诊断类型以及 CPU 数据的释放方式；私有状态则
 * 阻止子类把已经释放的对象重新变为可用。
 */
export abstract class Resource {
  /** 由基类独占维护的单向生命周期状态。 */
  private disposedValue: boolean = false

  /**
   * 当前持有该 Resource 的 Scene 数量。
   *
   * @remarks
   * 该字段只通过 retainSceneReference() 和 releaseSceneReference() 修改。
   * 它不表示 JavaScript 的真实对象引用数量，也不统计 Mesh 数量或 WebGL context 数量。
   */
  private sceneReferenceCountValue = 0

  /**
   * 按注册顺序保存 listener。`readonly` 禁止替换 Set，但允许增删其中的 listener。
   */
  private readonly disposeListeners = new Set<DisposeListener>()

  // ==================== protected ====================

  /**
   * 子类提供的稳定资源类型，不依赖可能被生产压缩器改写的 `constructor.name`。
   */
  protected abstract readonly resourceType: string

  /**
   * 由具体资源释放其 CPU 侧数据。
   *
   * @remarks
   * 基类保证正常路径上先通知所有 listener，再调用此方法。当前尚未定义 listener
   * 抛错时的容错策略，相关决策记录在 `src/rendering/TODOList.md`。
   */
  protected abstract disposeCPUData(): void

  /**
   * 供子类公共方法在访问内部数据前统一验证生命周期。
   *
   * @throws {@link ResourceDisposedError} 当资源已经完成或开始释放。
   */
  protected assertUsable(): void {
    if (this.disposedValue) {
      throw new ResourceDisposedError(this.resourceType)
    }
  }

  // ==================== public ====================

  /** 当前资源是否已经进入 disposed 状态。 */
  get disposed(): boolean {
    return this.disposedValue
  }

  /**
   * 获取当前持有该 Resource 的 Scene 数量。
   *
   * @returns 非负整数；调用者只能读取，不能直接修改。
   */
  get sceneReferenceCount(): number {
    return this.sceneReferenceCountValue
  }

  /**
   * 注册一个同步释放监听器。
   *
   * @param listener - Resource 首次释放时调用的清理函数。
   * @returns 幂等的取消订阅函数；Manager 先于 Resource 销毁时必须调用它。
   * @throws {@link ResourceDisposedError} 当资源已经释放，避免创建永远不会触发的订阅。
   */
  onDispose(listener: DisposeListener): () => void {
    if (this.disposedValue) {
      throw new ResourceDisposedError(this.resourceType)
    }

    this.disposeListeners.add(listener)

    return () => {
      this.disposeListeners.delete(listener)
    }
  }

  /**
   * 登记一个新的 Scene 存活引用。
   *
   * @remarks
   * retain 在引用计数语义中表示：“新增一个要求该 Resource 继续存活的持有者。”
   * 同一个 Scene 的对象身份去重由 Scene 内部 Set 负责，本方法只处理计数。
   *
   * @throws {@link ResourceDisposedError}
   * 已经真正释放的 Resource 不能重新恢复为可用状态。
   */
  retainSceneReference(): void {
    this.assertUsable()
    this.sceneReferenceCountValue += 1
  }

  /**
   * 释放一个 Scene 存活引用。
   *
   * @remarks
   * 方法先验证当前计数，之后只减少一次。计数从 1 变成 0 时，立即自动执行真正清理，
   * 避免产生“已经没有所有者，但仍等待其他代码调用 dispose”的泄漏状态。
   *
   * @throws {@link ResourceSceneReferenceUnderflowError}
   * 当前计数已经为 0 时抛出，且状态保持不变。
   */
  releaseSceneReference(): void {
    if (this.sceneReferenceCountValue === 0)
      throw new ResourceSceneReferenceUnderflowError(this.resourceType)

    this.sceneReferenceCountValue -= 1

    if (this.sceneReferenceCountValue === 0) this.finalizeDisposal()
  }

  /**
   * 尝试立即释放 Resource，而不把“仍有 Scene 引用”当成异常。
   *
   * @returns 调用结束后 Resource 已经 disposed 时返回 true；仍有 Scene 引用时返回 false。
   *
   * @remarks
   * [DESIGN-WEIGHT:2][resource-safe-try-dispose]
   *
   * 适用于“资源可能仍被共享”这一正常业务分支。返回 false 时，引用计数、listener、
   * disposed 状态和 CPU 数据全部保持不变。
   */
  tryDispose(): boolean {
    if (this.disposedValue) return true

    if (this.sceneReferenceCountValue > 0) return false

    this.finalizeDisposal()

    return true
  }

  /**
   * 严格要求 Resource 立即完成释放。
   *
   * @remarks
   * [DESIGN-WEIGHT:3][resource-strict-dispose]
   *
   * 没有 Scene 引用时，直接执行真正清理；已经 disposed 时保持幂等；仍有 Scene 引用
   * 时抛出领域错误。调用成功返回后，调用者可以确定 `disposed === true`。
   *
   * @throws {@link ResourceHasSceneReferencesError}
   * 一个或多个 Scene 仍然持有 Resource 时抛出，状态保持不变。对于正常的非异常尝试，
   * 调用 tryDispose()。
   */
  dispose(): void {
    if (this.disposedValue) return

    if (this.sceneReferenceCountValue > 0) {
      throw new ResourceHasSceneReferencesError(this.resourceType, this.sceneReferenceCountValue)
    }

    this.finalizeDisposal()
  }

  /**
   * 执行唯一的真正清理流程。
   *
   * @remarks
   * 只有两个入口可以抵达这里：
   *
   * - 无 Scene 引用时调用 dispose()/tryDispose()；
   * - releaseSceneReference() 把最后一个引用从 1 减到 0。
   *
   * 顺序固定为：标记 disposed → 按注册顺序通知 listener → 清空 listener →
   * disposeCPUData()。先标记状态可以阻止 listener 在释放期间重新使用资源。
   */
  private finalizeDisposal(): void {
    if (this.disposedValue) return

    this.disposedValue = true

    for (const listener of this.disposeListeners) {
      listener()
    }

    this.disposeListeners.clear()

    this.disposeCPUData()
  }
}
