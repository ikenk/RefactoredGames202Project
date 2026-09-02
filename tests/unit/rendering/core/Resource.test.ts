import { describe, expect, it } from 'vitest'

import { Resource } from '@/rendering/core/Resource'
import {
  ResourceDisposedError,
  ResourceHasSceneReferencesError,
  ResourceSceneReferenceUnderflowError
} from '@/rendering/core/errors'

/**
 * 把 Resource 的 protected 生命周期钩子转换成测试可以观察的公开行为。
 *
 * @remarks
 * 该辅助类不模拟 Resource；它使用真实基类实现，只记录 `disposeCPUData()` 的调用次数。
 */
class TestResource extends Resource {
  /** 与 JavaScript 类名不同，专门验证生产诊断不依赖 `constructor.name`。 */
  protected readonly resourceType = 'StableTestResource'

  /** CPU 清理钩子的可观察调用次数。 */
  public cpuDisposeCount = 0

  /** 暴露真实的 protected guard，供测试验证释放后的访问行为。 */
  public assertAvailable(): void {
    this.assertUsable()
  }

  protected disposeCPUData(): void {
    this.cpuDisposeCount += 1
  }
}

describe('Resource', () => {
  /**
   * 保护的错误实现：
   *
   * - Resource 创建时错误地认为已经有一个 Scene 引用；
   * - retain 没有实际增加计数；
   * - sceneReferenceCount 暴露的是旧值快照。
   *
   * Given 一个新 Resource，
   * When 两个 Scene 逻辑持有者分别登记引用，
   * Then 计数应从 0 依次变成 1、2。
   */
  it('从零开始记录每个 Scene 引用', () => {
    const resource = new TestResource()

    expect(resource.sceneReferenceCount).toBe(0)

    resource.retainSceneReference()
    expect(resource.sceneReferenceCount).toBe(1)

    resource.retainSceneReference()
    expect(resource.sceneReferenceCount).toBe(2)

    expect(resource.disposed).toBe(false)
    expect(resource.cpuDisposeCount).toBe(0)
  })

  /**
   * 保护的错误实现：
   *
   * - 第一个 Scene release 就提前清理共享资源；
   * - 最后一个引用消失后没有自动清理；
   * - listener 执行时引用计数仍然是 1。
   *
   * Given 两个 Scene 引用，
   * When 它们依次 release，
   * Then 第一次只减数，第二次减到零并执行真正清理。
   */
  it('只在最后一个 Scene 引用消失时自动执行真正清理', () => {
    const resource = new TestResource()
    const referenceCountsObservedDuringDispose: number[] = []

    resource.retainSceneReference()
    resource.retainSceneReference()

    resource.onDispose(() => {
      referenceCountsObservedDuringDispose.push(resource.sceneReferenceCount)
    })

    resource.releaseSceneReference()

    expect(resource.sceneReferenceCount).toBe(1)
    expect(resource.disposed).toBe(false)
    expect(resource.cpuDisposeCount).toBe(0)
    expect(referenceCountsObservedDuringDispose).toEqual([])

    resource.releaseSceneReference()

    expect(resource.sceneReferenceCount).toBe(0)
    expect(resource.disposed).toBe(true)
    expect(resource.cpuDisposeCount).toBe(1)
    expect(referenceCountsObservedDuringDispose).toEqual([0])
  })

  /**
   * 保护的错误实现：
   *
   * - 先把 0 减成 -1，再发现错误；
   * - 引用下溢被静默忽略；
   * - 下溢错误意外触发真正清理。
   */
  it('引用数为零时拒绝 release，并保持状态完全不变', () => {
    const resource = new TestResource()

    expect(() => resource.releaseSceneReference()).toThrow(ResourceSceneReferenceUnderflowError)

    expect(resource.sceneReferenceCount).toBe(0)
    expect(resource.disposed).toBe(false)
    expect(resource.cpuDisposeCount).toBe(0)
  })

  /**
   * 保护的错误实现：
   *
   * - strict dispose 强制销毁仍被 Scene 使用的资源；
   * - 抛错前错误减少引用；
   * - 抛错过程中触发 listener 或 CPU 清理。
   */
  it('仍有 Scene 引用时 strict dispose 抛错且不修改任何生命周期状态', () => {
    const resource = new TestResource()
    let notificationCount = 0

    resource.retainSceneReference()
    resource.onDispose(() => {
      notificationCount += 1
    })

    expect(() => resource.dispose()).toThrow(ResourceHasSceneReferencesError)

    expect(resource.sceneReferenceCount).toBe(1)
    expect(resource.disposed).toBe(false)
    expect(resource.cpuDisposeCount).toBe(0)
    expect(notificationCount).toBe(0)

    // 完成测试清理：最后一个合法引用消失后才真正释放。
    resource.releaseSceneReference()

    expect(resource.disposed).toBe(true)
  })

  /**
   * 保护的错误实现：
   *
   * - tryDispose 在无引用时仍返回 false；
   * - 成功后没有进入 disposed；
   * - 已释放对象第二次 tryDispose 返回 false。
   */
  it('tryDispose 在没有 Scene 引用时安全释放，并对已释放状态返回 true', () => {
    const resource = new TestResource()

    expect(resource.tryDispose()).toBe(true)

    expect(resource.disposed).toBe(true)
    expect(resource.sceneReferenceCount).toBe(0)
    expect(resource.cpuDisposeCount).toBe(1)

    expect(resource.tryDispose()).toBe(true)
    expect(resource.cpuDisposeCount).toBe(1)
  })

  /**
   * 保护的错误实现：
   *
   * - tryDispose 在不能释放时抛出异常；
   * - 返回 false 前偷偷减少 Scene 引用；
   * - 返回 false 时触发部分清理。
   */
  it('tryDispose 在仍有 Scene 引用时返回 false并保持状态不变', () => {
    const resource = new TestResource()
    let notificationCount = 0

    resource.retainSceneReference()
    resource.onDispose(() => {
      notificationCount += 1
    })

    expect(resource.tryDispose()).toBe(false)

    expect(resource.sceneReferenceCount).toBe(1)
    expect(resource.disposed).toBe(false)
    expect(resource.cpuDisposeCount).toBe(0)
    expect(notificationCount).toBe(0)

    resource.releaseSceneReference()

    expect(resource.disposed).toBe(true)
    expect(notificationCount).toBe(1)
  })

  /**
   * 保护的错误实现：先释放 CPU 数据，或在 listener 执行后才标记 disposed。
   *
   * Given 两个按顺序注册的 listener，
   * When 没有 Scene 引用的 Resource 首次 dispose，
   * Then 两者在 CPU 清理前依次执行。
   */
  it('按注册顺序通知所有 dispose listener，并在最后释放 CPU 数据', () => {
    const resource = new TestResource()
    const notifications: string[] = []

    resource.onDispose(() => {
      notifications.push('first')
      expect(resource.disposed).toBe(true)
      expect(resource.sceneReferenceCount).toBe(0)
      expect(resource.cpuDisposeCount).toBe(0)
    })
    resource.onDispose(() => {
      notifications.push('second')
      expect(resource.disposed).toBe(true)
      expect(resource.sceneReferenceCount).toBe(0)
      expect(resource.cpuDisposeCount).toBe(0)
    })

    resource.dispose()

    expect(notifications).toEqual(['first', 'second'])
    expect(resource.cpuDisposeCount).toBe(1)
    expect(resource.disposed).toBe(true)
  })

  /**
   * 保护的错误实现：取消订阅函数没有删除原 listener，导致已销毁 Manager 仍被通知。
   */
  it('取消订阅后不再通知对应 listener', () => {
    const resource = new TestResource()
    const notifications: string[] = []

    resource.onDispose(() => {
      notifications.push('kept')
    })
    const unsubscribe = resource.onDispose(() => {
      notifications.push('removed')
    })

    unsubscribe()
    resource.dispose()

    expect(notifications).toEqual(['kept'])
  })

  /**
   * 保护的错误实现：第二次 unsubscribe 因 listener 已不存在而抛错或改变其他订阅。
   */
  it('多次取消同一个 listener 保持幂等', () => {
    const resource = new TestResource()
    let notificationCount = 0

    const unsubscribe = resource.onDispose(() => {
      notificationCount += 1
    })

    unsubscribe()
    unsubscribe()
    resource.dispose()

    expect(notificationCount).toBe(0)
  })

  /**
   * 保护的错误实现：重复 dispose 再次通知 backend 或重复释放 CPU 数据。
   */
  it('dispose 多次只通知一次并只释放一次 CPU 数据', () => {
    const resource = new TestResource()
    let notificationCount = 0

    resource.onDispose(() => {
      notificationCount += 1
    })

    resource.dispose()
    resource.dispose()

    expect(notificationCount).toBe(1)
    expect(resource.cpuDisposeCount).toBe(1)
  })

  it('dispose 后拒绝 listener、受保护资源访问和新的 Scene 引用', () => {
    const resource = new TestResource()

    resource.dispose()

    expect(() => resource.onDispose(() => undefined)).toThrow(ResourceDisposedError)
    expect(() => resource.assertAvailable()).toThrow(ResourceDisposedError)
    expect(() => resource.retainSceneReference()).toThrow(ResourceDisposedError)
    expect(resource.sceneReferenceCount).toBe(0)
  })

  /**
   * 保护的错误实现：重新使用可能被 Terser 改写的 `constructor.name` 生成诊断消息。
   */
  it('使用显式稳定资源类型生成错误，不依赖 constructor.name', () => {
    const resource = new TestResource()

    resource.dispose()

    let caughtError: unknown

    try {
      resource.assertAvailable()
    } catch (error) {
      caughtError = error
    }

    expect(caughtError).toBeInstanceOf(ResourceDisposedError)

    if (!(caughtError instanceof ResourceDisposedError)) {
      throw new Error('Expected ResourceDisposedError')
    }

    expect(caughtError.message).toBe('StableTestResource has been disposed')
    expect(caughtError.details).toEqual({
      resourceName: 'StableTestResource'
    })
  })

  /**
   * 保护的错误实现：dispose 清空 Set 后，旧 unsubscribe 因内部状态已清除而抛错。
   */
  it('清空 listener 集合，使 dispose 后的 unsubscribe 仍安全', () => {
    const resource = new TestResource()
    const unsubscribe = resource.onDispose(() => undefined)

    resource.dispose()

    expect(() => unsubscribe()).not.toThrow()
  })
})
