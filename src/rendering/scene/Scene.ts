import { Resource } from '@/rendering/core/Resource'
import { ResourceDisposedError } from '@/rendering/core/errors'
import { Group } from '@/rendering/scene/Group'

/**
 * 场景图根节点及其共享 CPU Resource 引用的管理者。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][scene-resource-retention]
 *
 * Scene 同时承担两项职责：
 *
 * - 作为 Group 保存场景节点树；
 * - 为通过 retain() 登记的每个 Resource 持有一个 Scene 引用。
 *
 * 同一个 Scene 中多个 Mesh 使用同一 Geometry 时，该 Scene 仍然只持有一个引用；
 * 多个 Scene 使用同一 Geometry 时，每个 Scene 分别贡献一个引用。最后一个 Scene
 * 引用消失后，由 Resource 自动执行真正清理。
 *
 * Scene 不持有 WebGL context 或 GPU handle，也不直接删除 GPU 对象。
 */
export class Scene extends Group {
  /**
   * Scene 是否已经开始或完成释放。
   *
   * @remarks
   * 这是单向状态：false 可以变成 true，但不能重新变回 false。
   */
  private disposedValue = false

  /**
   * 当前 Scene 已经登记过的共享 Resource。
   *
   * @remarks
   * Set 保证每个 Scene 对同一 Resource 最多贡献一个引用。该 Set 记录的是当前 Scene
   * 自己的登记关系；总引用数量保存在每个 Resource.sceneReferenceCount 中。
   */
  private readonly retainedResources = new Set<Resource>()

  /**
   * 为 debugLabel 提供稳定的 Scene 类型。
   *
   * @remarks
   * [DESIGN-WEIGHT:2][scene-node-stable-debug-type]
   */
  protected override get debugType(): string {
    return 'Scene'
  }

  /**
   * 获取 Scene 是否已经进入 disposed 状态。
   */
  get disposed(): boolean {
    return this.disposedValue
  }

  /**
   * 为当前 Scene 登记一个 Resource 存活引用。
   *
   * @param resource - 当前 Scene 将要使用的 Resource。
   * @returns 原样返回具体 Resource 子类型，方便创建和登记写在同一个表达式中。
   *
   * @throws {@link ResourceDisposedError}
   * Scene 已经开始释放，或者 Resource 已经真正释放时抛出。
   *
   * @remarks
   * 方法先检查 Set。重复 retain 同一个对象时直接返回，不重复增加引用。
   *
   * 首次登记时先调用 Resource.retainSceneReference()，成功后才写入 Set。这样如果
   * Resource 已经 disposed 并拒绝 retain，Scene 不会留下错误的登记记录。
   *
   * @example
   * ```ts
   * const geometry = scene.retain(new Geometry(...))
   * ```
   */
  retain<T extends Resource>(resource: T): T {
    if (this.disposedValue) throw new ResourceDisposedError('Scene')

    if (this.retainedResources.has(resource)) return resource

    resource.retainSceneReference()
    this.retainedResources.add(resource)

    return resource
  }

  /**
   * 释放当前 Scene 对一个 Resource 的存活引用。
   *
   * @param resource - 当前 Scene 不再使用的 Resource。
   * @returns 当前 Scene 确实持有该引用并成功释放时返回 true；否则返回 false。
   *
   * @remarks
   * 方法先从 Set 删除，再调用 Resource.releaseSceneReference()。这个顺序保证最后一个
   * 引用触发同步 dispose listener 时，listener 再次调用 `scene.release(resource)`
   * 会看到该登记已经不存在，不会递归释放同一个引用。
   *
   * Scene.dispose() 开始后返回 false，防止一个 Resource listener 取消同一轮中尚未
   * 处理的其他 Resource 引用。
   */
  release(resource: Resource): boolean {
    if (this.disposedValue) return false

    if (!this.retainedResources.delete(resource)) return false

    resource.releaseSceneReference()

    return true
  }

  /**
   * 以幂等方式释放场景层级和当前 Scene 持有的所有 Resource 引用。
   *
   * @remarks
   * [DESIGN-WEIGHT:3][scene-dispose-order]
   *
   * 正常路径顺序固定为：
   *
   * 1. 把 Scene 标记为 disposed；
   * 2. 断开全部直接 child；
   * 3. 对每个 retained Resource 调用 releaseSceneReference()；
   * 4. 清空当前 Scene 的 retainedResources Set。
   *
   * Scene 不再直接调用 Resource.dispose()。如果其他 Scene 仍持有同一 Resource，
   * 引用数只会减少；如果当前 Scene 持有最后一个引用，Resource 会自动真正清理。
   *
   * Resource listener 抛错时是否继续释放剩余资源仍遵循
   * `src/rendering/TODOList.md` 中尚未确定的异常策略。
   */
  dispose(): void {
    if (this.disposedValue) return

    this.disposedValue = true

    this.removeAllChildren()

    for (const resource of this.retainedResources) {
      resource.releaseSceneReference()
    }

    this.retainedResources.clear()
  }
}
