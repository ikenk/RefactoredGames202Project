import { describe, expect, it } from 'vitest'

import { Resource } from '@/rendering/core/Resource'
import { ResourceDisposedError } from '@/rendering/core/errors'
import { Group } from '@/rendering/scene/Group'
import { Scene } from '@/rendering/scene/Scene'
import { SceneNode } from '@/rendering/scene/SceneNode'

/**
 * 把 Resource 的 protected CPU 清理钩子转换为测试可观察的计数。
 *
 * @remarks
 * 测试使用真实 Resource 生命周期，只替换具体资源释放 CPU 数据的部分。
 */
class TestResource extends Resource {
  /**
   * 稳定的资源诊断类型。
   *
   * 该属性同时保证测试辅助类满足 Resource 的抽象契约。
   */
  protected readonly resourceType = 'SceneTestResource'

  /** disposeCPUData() 的实际调用次数。 */
  public cpuDisposeCount = 0

  /** 记录一次 CPU 数据释放。 */
  protected disposeCPUData(): void {
    this.cpuDisposeCount += 1
  }
}

describe('Scene resource retention', () => {
  /**
   * 保护的错误实现：
   *
   * - Scene 没有继承 Group；
   * - 未命名 Scene 的 debugLabel 错误显示为 Group 或 SceneNode。
   */
  it('是 Group 场景根节点，并提供稳定的 Scene 调试类型', () => {
    const scene = new Scene()

    expect(scene).toBeInstanceOf(Group)
    expect(scene).toBeInstanceOf(SceneNode)
    expect(scene.disposed).toBe(false)
    expect(scene.debugLabel).toBe(`Scene#${scene.uuid.slice(0, 8)}`)
  })

  /**
   * 保护的错误实现：
   *
   * - retain() 不返回具体 Resource；
   * - 同一 Scene 重复登记同一对象时重复增加引用数；
   * - Scene Set 与 Resource 引用数不一致。
   *
   * Given 同一个 Resource，
   * When 同一 Scene 连续 retain 两次，
   * Then Scene 只持有一个引用。
   */
  it('retain 返回传入资源并让同一 Scene 按对象身份去重', () => {
    const scene = new Scene()
    const resource = new TestResource()

    expect(scene.retain(resource)).toBe(resource)
    expect(scene.retain(resource)).toBe(resource)
    expect(resource.sceneReferenceCount).toBe(1)

    scene.dispose()

    expect(resource.sceneReferenceCount).toBe(0)
    expect(resource.disposed).toBe(true)
    expect(resource.cpuDisposeCount).toBe(1)
  })

  /**
   * 保护的错误实现：
   *
   * - Scene.dispose() 只 release 第一个资源；
   * - Scene 只删除 Set，没有释放自己的 Resource 引用；
   * - 同一 Scene 对一个资源错误释放多次。
   */
  it('dispose 释放当前 Scene 对每个 retained Resource 的一个引用', () => {
    const scene = new Scene()
    const first = new TestResource()
    const second = new TestResource()

    scene.retain(first)
    scene.retain(second)

    expect(first.sceneReferenceCount).toBe(1)
    expect(second.sceneReferenceCount).toBe(1)

    scene.dispose()

    expect(first.sceneReferenceCount).toBe(0)
    expect(second.sceneReferenceCount).toBe(0)
    expect(first.disposed).toBe(true)
    expect(second.disposed).toBe(true)
    expect(first.cpuDisposeCount).toBe(1)
    expect(second.cpuDisposeCount).toBe(1)
  })

  /**
   * 这是引入 Scene 引用计数的核心验收测试。
   *
   * 保护的错误实现：
   *
   * - 第一个 Scene dispose 就直接调用 Resource.dispose()；
   * - 引用数没有按 Scene 增加；
   * - 最后一个 Scene 消失后 Resource 没有自动清理。
   *
   * Given 两个 Scene 同时 retain 同一个 Resource，
   * When 它们依次 dispose，
   * Then 第一个 Scene 只释放自己的引用，第二个 Scene 才触发真正清理。
   */
  it('允许两个 Scene 共享 Resource，并在最后一个 Scene 释放后才清理', () => {
    const firstScene = new Scene()
    const secondScene = new Scene()
    const sharedResource = new TestResource()

    firstScene.retain(sharedResource)
    secondScene.retain(sharedResource)

    expect(sharedResource.sceneReferenceCount).toBe(2)
    expect(sharedResource.disposed).toBe(false)

    firstScene.dispose()

    expect(sharedResource.sceneReferenceCount).toBe(1)
    expect(sharedResource.disposed).toBe(false)
    expect(sharedResource.cpuDisposeCount).toBe(0)

    secondScene.dispose()

    expect(sharedResource.sceneReferenceCount).toBe(0)
    expect(sharedResource.disposed).toBe(true)
    expect(sharedResource.cpuDisposeCount).toBe(1)
  })

  /**
   * 旧契约认为 release 只交还所有权、不会影响 Resource 生命周期。
   * 新契约规定 release 必须减少当前 Scene 持有的引用，最后一个引用消失时自动清理。
   *
   * 保护的错误实现：
   *
   * - release() 删除 Set 却没有减少 Resource 引用数；
   * - 重复 release 导致引用下溢；
   * - Scene.dispose() 再次释放已经 release 的引用。
   */
  it('release 减少当前 Scene 的一个引用并保持重复调用幂等', () => {
    const scene = new Scene()
    const resource = new TestResource()

    scene.retain(resource)

    expect(resource.sceneReferenceCount).toBe(1)
    expect(scene.release(resource)).toBe(true)

    expect(resource.sceneReferenceCount).toBe(0)
    expect(resource.disposed).toBe(true)
    expect(resource.cpuDisposeCount).toBe(1)

    expect(scene.release(resource)).toBe(false)

    scene.dispose()

    expect(resource.cpuDisposeCount).toBe(1)
  })

  /**
   * 保护的错误实现：
   *
   * - 先释放 Resource 引用、后断开 children；
   * - 只清空 children 数组，没有把 child.parent 恢复为 null。
   *
   * Given 一个 child 和一个带同步 dispose listener 的 Resource，
   * When Scene.dispose() 释放最后一个 Scene 引用，
   * Then listener 观察到的场景树已经完成双向断开。
   */
  it('dispose 先断开 children，再释放 retained resources', () => {
    const scene = new Scene()
    const child = new SceneNode()
    const resource = new TestResource()
    const childCountsObservedDuringResourceDispose: number[] = []
    const parentValuesObservedDuringResourceDispose: Array<SceneNode | null> = []

    scene.add(child)
    scene.retain(resource)

    resource.onDispose(() => {
      childCountsObservedDuringResourceDispose.push(scene.children.length)
      parentValuesObservedDuringResourceDispose.push(child.parent)
    })

    scene.dispose()

    expect(childCountsObservedDuringResourceDispose).toEqual([0])
    expect(parentValuesObservedDuringResourceDispose).toEqual([null])
    expect(scene.children).toEqual([])
    expect(child.parent).toBeNull()
  })

  /**
   * 保护的错误实现：
   *
   * - Resource listener 执行后才设置 Scene.disposed；
   * - 释放期间允许 retain 新资源，使新引用错过当前清理。
   */
  it('在 resource listener 执行前标记 disposed，并阻止释放期间重新 retain', () => {
    const scene = new Scene()
    const retainedResource = new TestResource()
    const lateResource = new TestResource()
    const disposedStatesObservedByListener: boolean[] = []
    const caughtErrors: unknown[] = []

    scene.retain(retainedResource)

    retainedResource.onDispose(() => {
      disposedStatesObservedByListener.push(scene.disposed)

      try {
        scene.retain(lateResource)
      } catch (error) {
        caughtErrors.push(error)
      }
    })

    scene.dispose()

    expect(disposedStatesObservedByListener).toEqual([true])
    expect(caughtErrors).toHaveLength(1)
    expect(caughtErrors[0]).toBeInstanceOf(ResourceDisposedError)
    expect(lateResource.sceneReferenceCount).toBe(0)
    expect(lateResource.disposed).toBe(false)
  })

  /**
   * 保护的错误实现：
   *
   * - Resource listener 可以通过 Scene.release() 删除尚未遍历的资源；
   * - 后续资源因此保留一个永远不会被释放的 Scene 引用。
   */
  it('dispose 开始后 release 不能取消本轮引用释放', () => {
    const scene = new Scene()
    const first = new TestResource()
    const second = new TestResource()
    const releaseResults: boolean[] = []

    scene.retain(first)
    scene.retain(second)

    first.onDispose(() => {
      releaseResults.push(scene.release(second))
    })

    scene.dispose()

    expect(releaseResults).toEqual([false])
    expect(second.sceneReferenceCount).toBe(0)
    expect(second.disposed).toBe(true)
    expect(second.cpuDisposeCount).toBe(1)
  })

  /**
   * 保护的错误实现：
   *
   * - 第二次 Scene.dispose() 再次 release Resource 引用；
   * - 重复 release 导致引用下溢；
   * - Scene.dispose() 忘记公开 disposed 状态。
   */
  it('dispose 保持幂等且不会重复减少 Scene 引用', () => {
    const scene = new Scene()
    const resource = new TestResource()

    scene.retain(resource)

    scene.dispose()
    scene.dispose()

    expect(scene.disposed).toBe(true)
    expect(resource.sceneReferenceCount).toBe(0)
    expect(resource.cpuDisposeCount).toBe(1)
    expect(scene.release(resource)).toBe(false)
  })

  /**
   * 保护的错误实现：
   *
   * - disposed Scene 继续登记新 Resource 引用；
   * - 抛出普通 Error；
   * - retain() 失败前已经增加 Resource 引用数。
   */
  it('dispose 后拒绝继续 retain Resource', () => {
    const scene = new Scene()
    const resource = new TestResource()

    scene.dispose()

    let caughtError: unknown

    try {
      scene.retain(resource)
    } catch (error) {
      caughtError = error
    }

    expect(caughtError).toBeInstanceOf(ResourceDisposedError)

    if (!(caughtError instanceof ResourceDisposedError)) {
      throw new Error('Expected ResourceDisposedError')
    }

    expect(caughtError.message).toBe('Scene has been disposed')
    expect(caughtError.details).toEqual({
      resourceName: 'Scene'
    })
    expect(resource.sceneReferenceCount).toBe(0)
    expect(resource.disposed).toBe(false)
  })

  /**
   * 保护的错误实现：
   *
   * - Scene 在 releaseSceneReference() 之后才从 Set 删除 Resource；
   * - 最后一个引用触发同步 listener 时，listener 重入释放同一 Resource；
   * - 重入调用错误地再次减少已经为零的引用计数。
   *
   * Given 当前 Scene 持有 Resource 的最后一个引用，
   * When Resource 的 dispose listener 重入调用 scene.release(resource)，
   * Then 外层 release 成功，重入 release 安全返回 false。
   */
  it('在触发同步 dispose listener 前删除 Scene 的 Resource 登记', () => {
    const scene = new Scene()
    const resource = new TestResource()
    const reentrantReleaseResults: boolean[] = []

    scene.retain(resource)

    resource.onDispose(() => {
      reentrantReleaseResults.push(scene.release(resource))
    })

    expect(scene.release(resource)).toBe(true)

    expect(reentrantReleaseResults).toEqual([false])
    expect(resource.sceneReferenceCount).toBe(0)
    expect(resource.disposed).toBe(true)
    expect(resource.cpuDisposeCount).toBe(1)
  })
})
