import { describe, expect, it } from 'vitest'

import { Group } from '@/rendering/scene/Group'
import { SceneNode } from '@/rendering/scene/SceneNode'

describe('Group', () => {
  /**
   * 保护的错误实现：
   *
   * - Group 没有继承 SceneNode；
   * - Group 没有覆写稳定 debugType；
   * - debugLabel 重新依赖可能被打包器改名的 constructor.name。
   *
   * Given 一个没有 name 的 Group，
   * When 读取它的类型和 debugLabel，
   * Then 它应当是 SceneNode，并以稳定的 `Group` 作为可读部分。
   */
  it('是 SceneNode 的语义化子类，并提供稳定的 Group 调试类型', () => {
    const group = new Group()

    expect(group).toBeInstanceOf(SceneNode)
    expect(group.name).toBe('')
    expect(group.debugLabel).toBe(`Group#${group.uuid.slice(0, 8)}`)
  })

  /**
   * 保护的错误实现：
   *
   * - Group 重新实现 add()，导致 parent/children 双向关系失配；
   * - Group 使用另一套 Transform；
   * - name 修改后 debugLabel 没有使用当前可读名称。
   *
   * Given 一个 Group 和一个普通 SceneNode，
   * When 修改 Group 的 name、local Transform 并添加 child，
   * Then 所有结果都应遵循 SceneNode 的既有契约。
   */
  it('直接复用 SceneNode 的 name、transform 和层级行为', () => {
    const group = new Group()
    const child = new SceneNode()

    group.name = 'root-group'
    group.transform.setPosition([1, 2, 3])
    group.add(child)

    expect(group.name).toBe('root-group')
    expect(group.debugLabel).toBe(`root-group#${group.uuid.slice(0, 8)}`)
    expect(group.transform.position).toEqual([1, 2, 3])
    expect(group.children).toEqual([child])
    expect(child.parent).toBe(group)
  })
})
