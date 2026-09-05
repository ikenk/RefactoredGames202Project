import { assertNever } from '@/errors/helper/helpers'
import { Resource } from '@/rendering/core/Resource'
import { InvalidGeometryError } from '@/rendering/core/errors'
import { VertexAttribute } from '@/rendering/resources/VertexAttribute'
import { VertexAttributeSemantic } from '@/rendering/resources/VertexAttributeSemantic'

/** WebGL1 静态 Geometry 支持的无符号索引数据类型。 */
export type IndexData = Uint8Array | Uint16Array | Uint32Array

/**
 * 此静态 Geometry 版本支持的 primitive topology。
 *
 * @remarks
 * 当前支持 triangles、lines、line-strip 和 triangle-strip。
 *
 * TODO(geometry-topology-expansion): 当后续作业或运行时需求确实需要 points、
 * line-loop、triangle-fan 等拓扑时，同步扩展类型、drawCount 验证、WebGL1 topology
 * 映射和测试。不能只扩展此 union。
 */
export type PrimitiveTopology = 'triangles' | 'lines' | 'line-strip' | 'triangle-strip'

/**
 * 创建具有独立 backing storage 的同类型 index TypedArray 副本。
 *
 * @param indices - 需要建立快照的索引数据。
 * @returns 与输入具有相同具体 TypedArray 类型的新实例。
 */
function copyIndexData(indices: IndexData): IndexData {
  if (indices instanceof Uint8Array) return new Uint8Array(indices)
  if (indices instanceof Uint16Array) return new Uint16Array(indices)
  if (indices instanceof Uint32Array) return new Uint32Array(indices)

  throw new InvalidGeometryError('indices use an unsupported TypedArray type')
}

/**
 * 验证 topology 能否用指定 drawCount 形成至少一个完整 primitive。
 *
 * @param topology - Geometry 声明的图元组织方式。
 * @param drawCount - indexed 时为 index count，否则为 position vertex count。
 *
 * @throws {@link InvalidGeometryError}
 * drawCount 不满足 topology 的最小数量或独立分组要求时抛出。
 * @throws `ExhaustiveMatchError`
 * 运行时输入绕过 PrimitiveTopology 联合类型并进入 default 分支时，由
 * {@link assertNever} 抛出。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][geometry-topology-exhaustiveness]
 *
 * triangles 和 lines 的每个 primitive 使用互不共享的固定分组；strip topology
 * 则在第一个 primitive 之后复用先前顶点，因此只要求最小数量。
 *
 * 每个合法 case 使用 break 离开 switch；default 必须保留在 switch 内部并调用
 * assertNever。这样既不会在 switch 后制造 TypeScript TS7027 不可达代码，又能让
 * 新增 PrimitiveTopology 成员但遗漏对应 case 时产生编译错误。
 */
function assertValidDrawCount(topology: PrimitiveTopology, drawCount: number): void {
  switch (topology) {
    case 'triangles': {
      if (drawCount < 3 || drawCount % 3 !== 0) {
        throw new InvalidGeometryError(
          `triangles require at least 3 draw elements and a count divisible by 3; received ${drawCount}`,
          {
            topology,
            drawCount
          }
        )
      }
      break
    }

    case 'lines': {
      if (drawCount < 2 || drawCount % 2 !== 0) {
        throw new InvalidGeometryError(
          `lines require at least 2 draw elements and a count divisible by 2; received ${drawCount}`,
          {
            topology,
            drawCount
          }
        )
      }
      break
    }

    case 'line-strip': {
      if (drawCount < 2) {
        throw new InvalidGeometryError(
          `line-strip requires at least 2 draw elements; received ${drawCount}`,
          {
            topology,
            drawCount
          }
        )
      }
      break
    }

    case 'triangle-strip': {
      if (drawCount < 3) {
        throw new InvalidGeometryError(
          `triangle-strip requires at least 3 draw elements; received ${drawCount}`,
          {
            topology,
            drawCount
          }
        )
      }
      break
    }

    default: {
      assertNever(topology, `[Geometry] unsupported primitive topology: ${String(topology)}`)
    }
  }
}

/**
 * 不含任何 GPU handle 的静态 CPU Geometry。
 *
 * @remarks
 * [DESIGN-WEIGHT:2][geometry-cpu-gpu-boundary]
 *
 * Geometry 只保存：
 *
 * - attribute semantic name 到不可变 VertexAttribute 的映射；
 * - 可选的无符号 index 快照；
 * - primitive topology；
 * - 已验证的 vertexCount 和 drawCount。
 *
 * Geometry 不知道 WebGL context、WebGLBuffer、VAO、attribute location 或扩展状态。
 * 后续每个 WebGL1Backend/context 的 GeometryManager 分别为同一 Geometry 创建和
 * 释放 GPU 表示。
 *
 * 初版 Geometry 是完全静态的，不提供 revision、usage 或 updateAttribute()。
 */
export class Geometry extends Resource {
  /** 不依赖 constructor.name 的稳定资源诊断类型。 */
  protected readonly resourceType = 'Geometry'

  /**
   * Geometry 自己持有的属性映射副本。
   *
   * @remarks
   * Map 本身不向外暴露；getAttributeNames() 返回新数组，getAttribute() 只返回
   * 已经不可变的 VertexAttribute。
   */
  private readonly attributesValue: Map<string, VertexAttribute>

  /**
   * Geometry 自己持有的 index 快照。
   *
   * @remarks
   * 字段不是 readonly，是为了在 disposeCPUData() 中断开对可能较大 TypedArray
   * backing buffer 的引用。公开 API 仍然没有任何修改索引的方法。
   */
  private indicesValue: IndexData | null

  /** position attribute 在构造时确定的顶点数量。 */
  private readonly vertexCountValue: number

  /** indexed 时为 index count，否则为 vertexCount。 */
  private readonly drawCountValue: number

  /** 经过构造验证的 primitive topology。 */
  private readonly topologyValue: PrimitiveTopology

  /**
   * 创建并验证静态 CPU Geometry。
   *
   * @param options.attributes - position、normal、uv 等语义名称到属性值的映射。
   * @param options.indices - 可选无符号索引数据；构造时复制。
   * @param options.topology - 图元组织方式；默认 triangles。
   *
   * @throws {@link InvalidGeometryError}
   * 缺少 position、position 为空、属性 count 不一致、索引越界或 drawCount
   * 不满足 topology 时抛出。
   *
   * @remarks
   * [DESIGN-WEIGHT:3][geometry-draw-count-validation]
   *
   * 构造过程先复制 attribute record 和 indices，再根据最终快照完成验证。
   * topology 验证使用真正提交给 draw call 的 drawCount：
   *
   * - 非索引 Geometry：`position.count`；
   * - 索引 Geometry：`indices.length`。
   */
  constructor(options: {
    readonly attributes: Readonly<Record<string, VertexAttribute>>
    readonly indices?: IndexData
    readonly topology?: PrimitiveTopology
  }) {
    super()

    const { attributes, indices, topology = 'triangles' } = options
    const copiedAttributes = new Map<string, VertexAttribute>(Object.entries(attributes))

    const position = copiedAttributes.get(VertexAttributeSemantic.Position)

    if (position === undefined) {
      throw new InvalidGeometryError('a position attribute is required')
    }

    const vertexCount = position.count

    if (vertexCount === 0) {
      throw new InvalidGeometryError('the position attribute must contain at least one vertex', {
        vertexCount
      })
    }

    for (const [attributeName, attribute] of copiedAttributes) {
      if (attribute.count !== vertexCount) {
        throw new InvalidGeometryError(
          `attribute ${attributeName} has ${attribute.count} vertices; expected ${vertexCount}`,
          {
            attributeName,
            attributeCount: attribute.count,
            vertexCount
          }
        )
      }
    }

    const copiedIndices = indices === undefined ? null : copyIndexData(indices)

    if (copiedIndices !== null) {
      for (const [indexOffset, vertexIndex] of copiedIndices.entries()) {
        if (vertexIndex >= vertexCount) {
          throw new InvalidGeometryError(
            `index ${vertexIndex} at offset ${indexOffset} is outside vertex count ${vertexCount}`,
            {
              indexOffset,
              vertexIndex,
              vertexCount
            }
          )
        }
      }
    }

    const drawCount = copiedIndices?.length ?? vertexCount

    assertValidDrawCount(topology, drawCount)

    this.attributesValue = copiedAttributes
    this.indicesValue = copiedIndices
    this.vertexCountValue = vertexCount
    this.drawCountValue = drawCount
    this.topologyValue = topology
  }

  /**
   * 获取指定语义名称的不可变 VertexAttribute。
   *
   * @param name - 属性语义，例如 position、normal 或 uv。
   * @returns 对应属性；不存在时返回 undefined。
   * @throws {@link ResourceDisposedError} Geometry 已释放时抛出。
   */
  getAttribute(name: string): VertexAttribute | undefined {
    this.assertUsable()

    return this.attributesValue.get(name)
  }

  /**
   * 按构造输入顺序复制所有属性名称。
   *
   * @returns 每次调用都创建的新数组。
   * @throws {@link ResourceDisposedError} Geometry 已释放时抛出。
   */
  getAttributeNames(): readonly string[] {
    this.assertUsable()

    return [...this.attributesValue.keys()]
  }

  /**
   * 复制索引数据。
   *
   * @returns indexed Geometry 返回同类型新 TypedArray；非 indexed Geometry 返回 null。
   * @throws {@link ResourceDisposedError} Geometry 已释放时抛出。
   */
  copyIndices(): IndexData | null {
    this.assertUsable()

    return this.indicesValue === null ? null : copyIndexData(this.indicesValue)
  }

  /**
   * 获取 position attribute 确定的顶点数量。
   *
   * @throws {@link ResourceDisposedError} Geometry 已释放时抛出。
   */
  get vertexCount(): number {
    this.assertUsable()

    return this.vertexCountValue
  }

  /**
   * 获取未来 draw call 实际消费的元素数量。
   *
   * @remarks
   * indexed Geometry 使用 index count；非 indexed Geometry 使用 vertexCount。
   *
   * @throws {@link ResourceDisposedError} Geometry 已释放时抛出。
   */
  get drawCount(): number {
    this.assertUsable()

    return this.drawCountValue
  }

  /**
   * 获取 Geometry 是否使用索引绘制。
   *
   * @throws {@link ResourceDisposedError} Geometry 已释放时抛出。
   */
  get indexed(): boolean {
    this.assertUsable()

    return this.indicesValue !== null
  }

  /**
   * 获取经过验证的 primitive topology。
   *
   * @throws {@link ResourceDisposedError} Geometry 已释放时抛出。
   */
  get topology(): PrimitiveTopology {
    this.assertUsable()

    return this.topologyValue
  }

  /**
   * 断开 Geometry 对 CPU attribute 和 index 数据的引用。
   *
   * @remarks
   * Resource 基类保证 dispose listener 已经先收到通知。每个 context 的
   * GeometryManager 应利用该通知删除自己的 WebGLBuffer；本方法本身绝不调用
   * WebGL API。
   */
  protected disposeCPUData(): void {
    this.attributesValue.clear()
    this.indicesValue = null
  }
}
