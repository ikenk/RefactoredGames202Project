import { mat4 } from 'gl-matrix'

import { DuplicateSceneNodeError, SceneGraphCycleError } from '@/rendering/core/errors'
import { Transform } from '@/rendering/scene/Transform'

/**
 * 场景图中的基础节点。
 *
 * @remarks
 * SceneNode 负责五类职责：
 *
 * - 保存稳定的完整 UUID；
 * - 保存可变的人类标签和可见性；
 * - 维护 parent/children 双向关系；
 * - 提供深度优先遍历；
 * - 根据 parent world matrix 与 local Transform 维护世界矩阵缓存。
 *
 * SceneNode 不拥有 Geometry、Material 或 GPU handle。资源所有权由后续 Scene 显式管理。
 *
 * [DESIGN-WEIGHT:3][scene-node-local-world-cache-separation]
 *
 * Transform 保存的是“当前节点相对 parent”的 local TRS 和 local matrix；
 * SceneNode 保存的是把祖先变换逐层组合后的 world matrix。对于列向量约定：
 *
 * ```text
 * node world = parent world × node local
 * ```
 *
 * root 没有 parent，因此只有 root 的 world matrix 等于自己的 local matrix。
 * 子节点不能把 local Transform 直接当成 world transform。
 */
export class SceneNode {
  /**
   * 面向开发者的可读标签。
   *
   * @remarks
   * name 可以为空、可以修改、也可以与其他节点重复，不能作为机器身份或缓存键。
   */
  public name = ''

  /**
   * 当前节点及其子树是否参加 visible traversal。
   *
   * @remarks
   * `traverseVisible()` 遇到 false 时会跳过整个子树，而不只是跳过当前节点。
   */
  public visible = true

  /**
   * 节点唯一的 local Transform。
   *
   * `readonly` 禁止调用者替换 Transform 对象，但仍允许调用它的 TRS setter。
   */
  public readonly transform = new Transform()

  /**
   * 结构变化产生的显式失效标志。
   *
   * @remarks
   * reparent 可能发生在 local Transform 和 parent version 都没有变化时，因此不能只靠
   * 两个版本号判断；移动节点及其后代时必须递归设置该标志。
   */
  private worldMatrixDirty = true

  /**
   * 创建节点时生成并永久保存的完整 UUID v4。
   *
   * @remarks
   * 短 UUID 只允许由 debugLabel 派生用于显示，内部身份始终保留完整字符串。
   */
  private readonly uuidValue = globalThis.crypto.randomUUID()

  // TODO(scene-serialization): When saving and reloading the same logical scene,
  // restore its original full UUID. clone() and repeated instantiation of the
  // same asset must allocate new UUIDs. SceneLoader must reject duplicate UUIDs
  // within one Scene. Do not add a general-purpose public UUID setter;
  // restoration must use a constrained loader-only mechanism.

  /** 当前父节点；null 表示该节点是一个 root。 */
  private parentValue: SceneNode | null = null

  /** 按插入顺序保存的直接子节点。 */
  private readonly childrenValue: SceneNode[] = []

  /** 最近一次计算得到的世界矩阵缓存。 */
  private readonly worldMatrixValue = mat4.create()

  /**
   * 最近一次世界矩阵计算观察到的 local Transform.version。
   *
   * @remarks
   * 当前值与 `transform.version` 不同时，说明 worldMatrixValue 尚未包含最新 local TRS。
   * 初始值 -1 与 Transform 从 0 开始的版本不相等，确保第一次更新必定执行。
   */
  private observedTransformVersion = -1

  /**
   * 最近一次世界矩阵计算观察到的 parent.worldVersion。
   *
   * @remarks
   * 即使当前节点的 local Transform 没变，parent 的 world matrix 变化也会改变当前节点
   * 的世界位置。root 使用 -1 代表“没有 parent”。
   */
  private observedParentWorldVersion = -1

  /**
   * 每次真正重算 worldMatrixValue 时恰好增加一次的单调版本号。
   *
   * @remarks
   * [DESIGN-WEIGHT:1][version-safe-integer-horizon]
   *
   * 子节点通过该值判断 parent world matrix 是否产生了新版本。重复调用
   * `updateWorldMatrix()` 但缓存仍有效时不会增加。
   *
   * JavaScript `number` 在 `Number.MAX_SAFE_INTEGER` 以内可精确表示整数。即使同一个
   * 节点每秒重算 60 次，也需要约 476 万年才会到达该上限，因此当前实时渲染生命周期
   * 不引入 BigInt 或回绕协议。
   */
  private worldVersionValue = 0

  /**
   * 获取完整且稳定的机器身份。
   *
   * @returns 创建节点时生成的完整 UUID v4。
   *
   * @remarks
   * 该属性只有 getter，没有普通 public setter。
   */
  get uuid(): string {
    return this.uuidValue
  }

  /**
   * 获取不受打包器类名压缩影响的稳定诊断类型。
   *
   * @returns 当前节点类型用于日志显示的稳定名称。
   *
   * @remarks
   * [DESIGN-WEIGHT:2][scene-node-stable-debug-type]
   *
   * SceneNode 本身是可直接实例化的具体类，因此提供 `'SceneNode'` 默认实现，而不是
   * 声明 abstract member。Group、Scene、Mesh 等子类可以 override 该 getter，返回
   * 显式字符串；生产构建即使重命名 constructor，也不会改变 debugLabel。
   */
  protected get debugType(): string {
    return 'SceneNode'
  }

  /**
   * 获取面向日志和调试界面的短显示标签。
   *
   * @returns `${name 或稳定 debugType}#${UUID 前 8 位}`。
   *
   * @remarks
   * debugLabel 不是机器身份、序列化主键或 ResourceManager 缓存键。
   * 不使用 `this.constructor.name`，避免生产打包器重命名类后使日志失去可读性。
   */
  get debugLabel(): string {
    const readableName = this.name || this.debugType
    return `${readableName}#${this.uuidValue.slice(0, 8)}`
  }

  /** 获取当前父节点。 */
  get parent(): SceneNode | null {
    return this.parentValue
  }

  /**
   * 获取直接子节点的浅拷贝。
   *
   * @returns 保持插入顺序的新数组。
   *
   * @remarks
   * 返回副本可以阻止调用者绕过 add/remove 修改内部数组并破坏双向关系。
   */
  get children(): ReadonlyArray<SceneNode> {
    return [...this.childrenValue]
  }

  /**
   * 获取世界矩阵缓存版本。
   *
   * @remarks
   * local 或 parent 变化不会立刻增加该值；只有 `updateWorldMatrix()` 真正重算时增加。
   * `observedParentWorldVersion` 是子节点保存的旧快照，本 getter 返回的是当前节点对外
   * 发布的新版本；二者形成 parent 到 child 的缓存失效通知链。
   */
  get worldVersion(): number {
    return this.worldVersionValue
  }

  /**
   * 原子地把一个或多个节点接到当前节点下面。
   *
   * @param nodes - 按参数顺序接入的节点。
   * @returns 当前节点，支持链式调用。
   *
   * @throws {@link DuplicateSceneNodeError}
   * 同一次调用中出现相同节点对象时抛出，并保证树完全不变。
   *
   * @throws {@link SceneGraphCycleError}
   * 接入当前节点自身或其祖先时抛出，并保证树完全不变。
   *
   * @remarks
   * 方法先完成全部验证，之后才进行 detach/attach。节点已有旧 parent 时会先从旧 parent
   * 原子移除；local Transform 保持不变，但移动节点及其后代的世界矩阵缓存全部失效。
   */
  add(...nodes: SceneNode[]): this {
    const seen = new Set<SceneNode>()

    // 验证阶段禁止修改场景图，确保任一输入失败时不会留下部分结果。
    for (const node of nodes) {
      if (seen.has(node)) throw new DuplicateSceneNodeError(node.debugLabel)

      seen.add(node)
      this.assertCanAdopt(node)
    }

    // 所有输入都通过后才进入提交阶段。
    for (const node of nodes) {
      node.removeFromParent()
      node.parentValue = this
      this.childrenValue.push(node)
      node.markWorldMatrixDirtyRecursively()
    }

    return this
  }

  /**
   * 从当前节点移除一个直接子节点。
   *
   * @param node - 尝试移除的节点。
   * @returns 当前节点，支持链式调用。
   *
   * @remarks
   * node 不是直接子节点时保持幂等，不抛错也不修改其他关系。
   */
  remove(node: SceneNode): this {
    const childIndex = this.childrenValue.indexOf(node)

    if (childIndex === -1) {
      return this
    }

    this.childrenValue.splice(childIndex, 1)
    node.parentValue = null
    node.markWorldMatrixDirtyRecursively()

    return this
  }

  /**
   * 从当前 parent 移除自身。
   *
   * @returns 当前节点，支持链式调用。
   */
  removeFromParent(): this {
    if (this.parentValue !== null) {
      this.parentValue.remove(this)
    }

    return this
  }

  /**
   * 断开全部直接子节点并保持双方关系一致。
   *
   * @returns 当前节点，支持链式调用。
   */
  removeAllChildren(): this {
    for (const child of this.childrenValue) {
      child.parentValue = null
      child.markWorldMatrixDirtyRecursively()
    }

    this.childrenValue.length = 0

    return this
  }

  /**
   * 以先父后子的深度优先顺序访问当前节点及全部后代。
   *
   * @param visitor - 对每个节点同步调用的处理函数。
   */
  traverse(visitor: (node: SceneNode) => void): void {
    visitor(this)

    for (const child of this.childrenValue) {
      child.traverse(visitor)
    }
  }

  /**
   * 以先父后子的深度优先顺序访问可见节点。
   *
   * @param visitor - 对每个可见节点同步调用的处理函数。
   *
   * @remarks
   * 当前节点不可见时立即返回，不访问 visitor，也不继续访问任何后代。
   */
  traverseVisible(visitor: (node: SceneNode) => void): void {
    if (!this.visible) {
      return
    }

    visitor(this)

    for (const child of this.childrenValue) {
      child.traverseVisible(visitor)
    }
  }

  /**
   * 按需更新当前节点的世界矩阵。
   *
   * @remarks
   * [DESIGN-WEIGHT:3][scene-node-local-world-cache-separation]
   *
   * 更新顺序固定为：
   *
   * 1. 先确保 parent 世界矩阵最新；
   * 2. 比较 local Transform.version、parent worldVersion 和结构 dirty flag；
   * 3. 没有变化时直接返回；
   * 4. 把 local matrix 直接复制进 worldMatrixValue；
   * 5. 非 root 原地计算 `parent world * local`，root 在上一步已经完成；
   * 6. 记录观察到的版本并增加本节点 worldVersion。
   *
   * 三类失效来源分别由不同状态检测：
   *
   * - `observedTransformVersion` 检测自己的 local TRS 变化；
   * - `observedParentWorldVersion` 检测 parent world matrix 变化；
   * - `worldMatrixDirty` 检测 reparent 等结构变化。
   *
   * dirty 不能被两个版本号完全替代：两个不同 parent 可能碰巧具有相同的
   * worldVersion 数字，但它们的 world matrix 不同。reparent 必须显式使缓存失效。
   *
   * [DESIGN-WEIGHT:2][scene-node-in-place-world-matrix]
   *
   * Transform 是管理 TRS、version 和 local-matrix cache 的对象，不是 `mat4`。
   * 本方法先通过复制 API 把 local matrix 写入 `worldMatrixValue`，再把同一个矩阵同时
   * 作为 `mat4.multiply()` 的输出和右操作数：
   *
   * ```text
   * out = parentWorld × out
   * ```
   *
   * 当前 gl-matrix 实现明确支持 `out === b`：它会在覆盖每组输出前缓存对应的右操作数。
   * 这样无需为每个 SceneNode 永久保存第二个 mat4。乘法顺序不能交换；parent 带旋转或
   * scale 时，`local × parentWorld` 会产生不同且错误的世界变换。
   */
  updateWorldMatrix(): void {
    let parentWorldVersion = -1

    if (this.parentValue !== null) {
      this.parentValue.updateWorldMatrix()
      parentWorldVersion = this.parentValue.worldVersionValue
    }

    const transformVersion = this.transform.version
    const cacheIsCurrent =
      !this.worldMatrixDirty &&
      this.observedTransformVersion === transformVersion &&
      this.observedParentWorldVersion === parentWorldVersion

    if (cacheIsCurrent) {
      return
    }

    this.transform.copyLocalMatrixTo(this.worldMatrixValue)

    if (this.parentValue !== null) {
      mat4.multiply(this.worldMatrixValue, this.parentValue.worldMatrixValue, this.worldMatrixValue)
    }

    this.observedTransformVersion = transformVersion
    this.observedParentWorldVersion = parentWorldVersion
    this.worldMatrixDirty = false
    this.worldVersionValue += 1
  }

  /**
   * 把最新世界矩阵复制到调用者提供的输出矩阵。
   *
   * @param out - 由调用者拥有并接收结果的 mat4。
   *
   * @remarks
   * 方法会先按需更新当前节点及祖先。调用者修改 out 不会污染内部世界矩阵缓存。
   */
  copyWorldMatrixTo(out: mat4): void {
    this.updateWorldMatrix()
    mat4.copy(out, this.worldMatrixValue)
  }

  /**
   * 验证当前节点是否可以收养目标节点。
   *
   * @param node - 准备接入的目标节点。
   * @throws {@link SceneGraphCycleError} node 是当前节点或当前节点祖先时抛出。
   *
   * @remarks
   * 新增边 `this → node` 只会在 node 已位于 this 的祖先链上时形成循环。
   * 因此从 this 沿 parent 向上检查即可，复杂度为 O(tree height)、额外空间 O(1)。
   */
  private assertCanAdopt(node: SceneNode): void {
    for (let current = this as SceneNode | null; current !== null; current = current.parentValue) {
      if (current === node) throw new SceneGraphCycleError(this.debugLabel, node.debugLabel)
    }
  }

  /**
   * 递归使当前节点及其全部后代的世界矩阵缓存失效。
   *
   * @remarks
   * 结构变化不会立即重算矩阵或增加 worldVersion；真正的更新仍由
   * `updateWorldMatrix()` 延迟执行。
   */
  private markWorldMatrixDirtyRecursively(): void {
    this.worldMatrixDirty = true

    for (const child of this.childrenValue) {
      child.markWorldMatrixDirtyRecursively()
    }
  }
}
