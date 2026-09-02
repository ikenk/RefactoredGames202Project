import { readFileSync } from 'node:fs'
import { mat4 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import { DuplicateSceneNodeError, SceneGraphCycleError } from '@/rendering/core/errors'
import { SceneNode } from '@/rendering/scene/SceneNode'

/**
 * RFC 4122 UUID v4 的完整文本形状。
 *
 * @remarks
 * 第三组必须以 4 开头；第四组必须以 8、9、a 或 b 开头。
 * 该断言只验证 UUID 形状和节点间差异，不尝试证明随机数生成器的统计质量。
 */
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 通过 SceneNode 的复制 API获得世界矩阵。
 *
 * @param node - 需要读取世界矩阵的节点。
 * @returns 一个由测试拥有的新 mat4；修改它不会影响 SceneNode。
 */
function copyWorldMatrix(node: SceneNode): mat4 {
  const output = mat4.create()
  node.copyWorldMatrixTo(output)
  return output
}

/**
 * SceneNode 的身份契约。
 *
 * @remarks
 * UUID 是稳定机器身份，name 是可变且可重复的人类标签，debugLabel 只用于显示。
 * 三者不能合并成一个字段。
 */
describe('SceneNode identity', () => {
  /**
   * 保护的错误实现：只保存 8 位短 ID、使用递增数字代替 UUID，
   * 或者所有节点意外复用同一个模块级 UUID。
   */
  it('为每个节点生成不同的完整 UUID v4', () => {
    const first = new SceneNode()
    const second = new SceneNode()

    expect(first.uuid).toMatch(UUID_V4_PATTERN)
    expect(second.uuid).toMatch(UUID_V4_PATTERN)
    expect(first.uuid).toHaveLength(36)
    expect(second.uuid).toHaveLength(36)
    expect(first.uuid).not.toBe(second.uuid)
  })

  /**
   * 保护的错误实现：为方便反序列化而增加普通 public setter，
   * 允许任意调用者在运行期间篡改机器身份。
   */
  it('只公开 UUID getter，不公开普通 setter', () => {
    const descriptor = Object.getOwnPropertyDescriptor(SceneNode.prototype, 'uuid')

    expect(descriptor?.get).toBeTypeOf('function')
    expect(descriptor?.set).toBeUndefined()
  })

  /**
   * 保护的错误实现：根据 name、parent 或 transform 重新计算 UUID，
   * 把稳定身份错误地变成当前场景状态的派生值。
   */
  it('rename、reparent、visibility 和 transform 修改都不改变 UUID', () => {
    const firstParent = new SceneNode()
    const secondParent = new SceneNode()
    const node = new SceneNode()
    const originalUUID = node.uuid

    node.name = 'renamed'
    node.visible = false
    node.transform.setPosition([1, 2, 3])
    firstParent.add(node)
    secondParent.add(node)

    expect(node.uuid).toBe(originalUUID)
  })

  /**
   * 保护的错误实现：把 name 当成唯一身份，禁止重名；
   * 或者 debugLabel 没有加入短 UUID，导致重名节点无法区分。
   */
  it('name 可变且可重复，但 debugLabel 使用短 UUID 区分显示', () => {
    const first = new SceneNode()
    const second = new SceneNode()

    expect(first.debugLabel).toBe(`SceneNode#${first.uuid.slice(0, 8)}`)

    first.name = 'mesh'
    second.name = 'mesh'

    expect(first.name).toBe(second.name)
    expect(first.debugLabel).toBe(`mesh#${first.uuid.slice(0, 8)}`)
    expect(second.debugLabel).toBe(`mesh#${second.uuid.slice(0, 8)}`)
    expect(first.debugLabel).not.toBe(second.debugLabel)
  })

  /**
   * 验证没有 name 时使用显式、稳定且可由子类覆盖的诊断类型。
   *
   * @remarks
   * [DESIGN-WEIGHT:2][scene-node-stable-debug-type]
   *
   * 保护的错误实现：使用 `this.constructor.name` 作为 fallback。该名称可能被生产
   * 打包器压缩或重命名，使日志出现 `a#12345678` 之类无法识别的标签。
   */
  it('debugLabel 使用稳定 debugType 而不是运行时 constructor.name', () => {
    class MinifiedLikeNode extends SceneNode {
      protected override get debugType(): string {
        return 'Mesh'
      }
    }

    const node = new MinifiedLikeNode()

    expect(node.debugLabel).toBe(`Mesh#${node.uuid.slice(0, 8)}`)
  })

  /**
   * 保护的错误实现：只在内部保存短 UUID，并把 debugLabel 误作序列化主键或缓存键。
   */
  it('debugLabel 的 8 位前缀不是完整机器身份', () => {
    const node = new SceneNode()
    const shortUUID = node.uuid.slice(0, 8)

    expect(node.debugLabel).toContain(shortUUID)
    expect(shortUUID).not.toBe(node.uuid)
    expect(node.debugLabel).not.toBe(node.uuid)
  })

  /**
   * 验证用户明确要求保留的未来场景序列化设计标记。
   *
   * @remarks
   * 这是一个有意的源码策略测试，而不是运行时行为测试。它防止未来重构只保留 UUID
   * 属性，却遗漏 reload、clone、asset instance、duplicate detection 和 setter 边界。
   */
  it('保留唯一且可搜索的 TODO(scene-serialization) 语义', () => {
    const source = readFileSync(
      new URL('../../../../src/rendering/scene/SceneNode.ts', import.meta.url),
      'utf8'
    )
    const markers = source.match(/TODO\(scene-serialization\)/g) ?? []

    expect(markers).toHaveLength(1)
    expect(source).toContain('restore its original full UUID')
    expect(source).toContain('clone() and repeated instantiation of the')
    expect(source).toContain('same asset must allocate new UUIDs')
    expect(source).toContain('SceneLoader must reject duplicate UUIDs')
    expect(source).toContain('Do not add a general-purpose public UUID setter')
  })
})

/**
 * SceneNode 的父子关系与遍历契约。
 *
 * @remarks
 * 所有结构修改都必须维护 parent/children 双向一致，并且失败的批量 add 不能留下部分结果。
 */
describe('SceneNode hierarchy', () => {
  /**
   * 保护的错误实现：直接返回内部 children 数组，使调用者能够绕过 add/remove
   * 修改树结构，并破坏 child.parent 的反向关系。
   */
  it('children 返回浅拷贝，外部修改数组不改变场景树', () => {
    const parent = new SceneNode()
    const child = new SceneNode()

    parent.add(child)

    const returnedChildren = parent.children as SceneNode[]
    returnedChildren.length = 0

    expect(parent.children).toEqual([child])
    expect(child.parent).toBe(parent)
  })

  /**
   * 保护的错误实现：使用无序集合保存 children，或倒序插入批量 add 的参数。
   */
  it('add 保留参数顺序', () => {
    const parent = new SceneNode()
    const first = new SceneNode()
    const second = new SceneNode()
    const third = new SceneNode()

    parent.add(first, second, third)

    expect(parent.children).toEqual([first, second, third])
  })

  /**
   * 保护的错误实现：边验证边修改，第一次添加成功后才发现第二个参数是重复节点，
   * 从而破坏批量操作的原子性。
   */
  it('同一次 add 中出现重复节点时整体失败且不修改树', () => {
    const parent = new SceneNode()
    const child = new SceneNode()

    expect(() => parent.add(child, child)).toThrow(DuplicateSceneNodeError)
    expect(parent.children).toEqual([])
    expect(child.parent).toBeNull()
  })

  /**
   * 保护的错误实现：只拒绝 `node === this`，却允许把祖先挂到后代下面形成间接循环；
   * 或者检测到循环前已经修改了一部分 parent/children。
   */
  it('拒绝祖先循环并保留失败前的完整关系', () => {
    const root = new SceneNode()
    const child = new SceneNode()
    const grandchild = new SceneNode()

    root.add(child)
    child.add(grandchild)

    expect(() => grandchild.add(root)).toThrow(SceneGraphCycleError)

    expect(root.parent).toBeNull()
    expect(root.children).toEqual([child])
    expect(child.parent).toBe(root)
    expect(child.children).toEqual([grandchild])
    expect(grandchild.parent).toBe(child)
  })

  /**
   * 保护的错误实现：接入新 parent 时没有从旧 parent 移除；
   * 或者 reparent 错误修改了节点的 local transform。
   */
  it('reparent 原子地从旧 parent 移到新 parent 并保持 local transform', () => {
    const firstParent = new SceneNode()
    const secondParent = new SceneNode()
    const child = new SceneNode()

    child.transform.setPosition([2, 3, 4])
    firstParent.add(child)
    secondParent.add(child)

    expect(firstParent.children).toEqual([])
    expect(secondParent.children).toEqual([child])
    expect(child.parent).toBe(secondParent)
    expect(child.transform.position).toEqual([2, 3, 4])
  })

  /**
   * 保护的错误实现：reparent 只改变 parent 指针，却没有使移动节点及其后代的
   * world-matrix cache 失效。
   */
  it('reparent 使被移动节点和后代的 world matrix 失效', () => {
    const firstParent = new SceneNode()
    const secondParent = new SceneNode()
    const child = new SceneNode()
    const grandchild = new SceneNode()

    firstParent.transform.setPosition([1, 0, 0])
    secondParent.transform.setPosition([10, 0, 0])
    child.transform.setPosition([2, 0, 0])
    grandchild.transform.setPosition([3, 0, 0])

    firstParent.add(child)
    child.add(grandchild)
    grandchild.updateWorldMatrix()

    const versionBeforeReparent = grandchild.worldVersion

    secondParent.add(child)
    grandchild.updateWorldMatrix()

    // 10（新 parent）+ 2（child local）+ 3（grandchild local）= 15。
    expect(copyWorldMatrix(grandchild)[12]).toBe(15)
    expect(grandchild.worldVersion).toBeGreaterThan(versionBeforeReparent)
  })

  /**
   * 保护的错误实现：只修改 parent.children 或只修改 child.parent，
   * 以及重复 remove 时错误删除其他节点或抛出异常。
   */
  it('remove、removeFromParent 和 removeAllChildren 保持双向关系且幂等', () => {
    const parent = new SceneNode()
    const first = new SceneNode()
    const second = new SceneNode()

    parent.add(first, second)

    parent.remove(first)
    parent.remove(first)

    expect(parent.children).toEqual([second])
    expect(first.parent).toBeNull()

    second.removeFromParent()
    second.removeFromParent()

    expect(parent.children).toEqual([])
    expect(second.parent).toBeNull()

    parent.add(first, second)
    parent.removeAllChildren()
    parent.removeAllChildren()

    expect(parent.children).toEqual([])
    expect(first.parent).toBeNull()
    expect(second.parent).toBeNull()
  })

  /**
   * 保护的错误实现：后序遍历、广度优先遍历，或打乱 siblings 的插入顺序。
   */
  it('traverse 按先父后子和 children 顺序遍历', () => {
    const root = new SceneNode()
    const first = new SceneNode()
    const second = new SceneNode()
    const grandchild = new SceneNode()
    const visited: SceneNode[] = []

    root.add(first, second)
    first.add(grandchild)

    root.traverse((node) => {
      visited.push(node)
    })

    expect(visited).toEqual([root, first, grandchild, second])
  })

  /**
   * 保护的错误实现：只跳过隐藏节点本身，却仍遍历其后代；
   * 这会让不可见父节点下面的 Mesh 继续进入 render list。
   */
  it('traverseVisible 跳过不可见节点的整个子树', () => {
    const root = new SceneNode()
    const hidden = new SceneNode()
    const hiddenChild = new SceneNode()
    const visible = new SceneNode()
    const visited: SceneNode[] = []

    hidden.visible = false
    root.add(hidden, visible)
    hidden.add(hiddenChild)

    root.traverseVisible((node) => {
      visited.push(node)
    })

    expect(visited).toEqual([root, visible])
  })
})

/**
 * SceneNode 的世界矩阵缓存协议。
 *
 * @remarks
 * Transform 只负责 local matrix；SceneNode 负责把 parent world 与 local 相乘，
 * 并通过 transform version、parent worldVersion 和结构 dirty flag 决定是否重算。
 */
describe('SceneNode world matrix', () => {
  /**
   * 保护的错误实现：使用 `local * parent` 的错误乘法顺序，
   * 或者计算 child 时没有先更新 parent。
   */
  it('按照 parent world * local 计算世界矩阵', () => {
    const parent = new SceneNode()
    const child = new SceneNode()

    // Given：parent 同时具有平移和非均匀缩放，child 具有局部平移。
    // 单纯使用两个平移矩阵无法发现乘法顺序写反，因为平移在该特例中会交换。
    parent.transform.setPosition([10, 0, 0])
    parent.transform.setScale([2, 3, 4])
    child.transform.setPosition([2, 3, 4])
    parent.add(child)

    // When：从 child 读取组合后的世界矩阵。
    const worldMatrix = copyWorldMatrix(child)

    // Then：parent scale 先作用于 child local translation，再加 parent translation。
    // x = 10 + 2 * 2 = 14；y = 0 + 3 * 3 = 9；z = 0 + 4 * 4 = 16。
    expect(worldMatrix[12]).toBe(14)
    expect(worldMatrix[13]).toBe(9)
    expect(worldMatrix[14]).toBe(16)
  })

  /**
   * 保护的错误实现：每次调用 updateWorldMatrix 都无条件重算并增加 worldVersion，
   * 导致下游缓存即使场景没有变化也持续失效。
   */
  it('没有变化时重复 updateWorldMatrix 不增加 worldVersion', () => {
    const parent = new SceneNode()
    const child = new SceneNode()

    parent.add(child)
    child.updateWorldMatrix()

    const parentVersion = parent.worldVersion
    const childVersion = child.worldVersion

    child.updateWorldMatrix()
    child.updateWorldMatrix()

    expect(parent.worldVersion).toBe(parentVersion)
    expect(child.worldVersion).toBe(childVersion)
  })

  /**
   * 保护的错误实现：setter 立即增加 worldVersion，或者 child 没有观察 parent 的
   * worldVersion，因而父节点移动后仍使用旧世界矩阵。
   */
  it('parent 或 local transform 变化后只在更新时增加 worldVersion', () => {
    const parent = new SceneNode()
    const child = new SceneNode()

    parent.transform.setPosition([1, 0, 0])
    child.transform.setPosition([2, 0, 0])
    parent.add(child)
    child.updateWorldMatrix()

    const initialParentVersion = parent.worldVersion
    const initialChildVersion = child.worldVersion

    // 修改 local Transform 只增加 Transform.version，不应立即重算 world matrix。
    parent.transform.setPosition([4, 0, 0])

    expect(parent.worldVersion).toBe(initialParentVersion)
    expect(child.worldVersion).toBe(initialChildVersion)

    child.updateWorldMatrix()

    expect(parent.worldVersion).toBe(initialParentVersion + 1)
    expect(child.worldVersion).toBe(initialChildVersion + 1)
    expect(copyWorldMatrix(child)[12]).toBe(6)

    child.transform.setPosition([5, 0, 0])
    child.updateWorldMatrix()

    expect(child.worldVersion).toBe(initialChildVersion + 2)
    expect(copyWorldMatrix(child)[12]).toBe(9)
  })

  /**
   * 保护的错误实现：直接返回 SceneNode 内部 world Float32Array，
   * 使调用者可以在不更新 version 的情况下篡改缓存。
   */
  it('copyWorldMatrixTo 不泄漏内部 Float32Array', () => {
    const node = new SceneNode()
    const firstOutput = mat4.create()
    const secondOutput = mat4.create()

    node.transform.setPosition([2, 3, 4])
    node.copyWorldMatrixTo(firstOutput)

    firstOutput[12] = 999
    node.copyWorldMatrixTo(secondOutput)

    expect(secondOutput[12]).toBe(2)
    expect(secondOutput[13]).toBe(3)
    expect(secondOutput[14]).toBe(4)
  })
})
