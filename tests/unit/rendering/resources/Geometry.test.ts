import { describe, expect, it } from 'vitest'

import { ExhaustiveMatchError } from '@/errors/LanguageError/ExhaustiveMatchError'
import { InvalidGeometryError, ResourceDisposedError } from '@/rendering/core/errors'
import { Geometry, type PrimitiveTopology } from '@/rendering/resources/Geometry'
import { VertexAttribute } from '@/rendering/resources/VertexAttribute'

/**
 * 创建具有确定顶点数量的三分量 position attribute。
 *
 * @remarks
 * 该 helper 只减少测试数据构造重复，不计算任何 expected value。所有断言中的
 * vertexCount、drawCount 和属性名称仍由测试使用字面值独立给出。
 */
function createPositionAttribute(vertexCount: number): VertexAttribute {
  const data = new Float32Array(vertexCount * 3)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = index
  }

  return new VertexAttribute({
    data,
    itemSize: 3
  })
}

/**
 * 验证 Geometry 对 attribute record 和 index data 建立稳定 CPU 快照。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][vertex-attribute-immutable-snapshot]
 *
 * Geometry 复制的是“属性名称到 VertexAttribute 的映射关系”；VertexAttribute
 * 本身已经是不可变值对象，所以 Geometry 可以安全保留其对象引用。
 */
describe('Geometry construction and CPU snapshots', () => {
  /**
   * Given：调用者持有一个之后仍会修改的普通属性对象。
   * When：构造 Geometry 后替换和删除该对象中的字段。
   * Then：Geometry 内部的属性映射保持构造时状态。
   *
   * 保护的错误实现：直接保存 attributes record，使外部 delete/assignment 改变
   * Geometry 的 vertexCount 或属性集合。
   */
  it('复制 attribute record 并保留不可变 VertexAttribute 引用', () => {
    const position = createPositionAttribute(3)
    const normal = createPositionAttribute(3)
    const attributes: Record<string, VertexAttribute> = {
      position,
      normal
    }

    const geometry = new Geometry({
      attributes
    })

    attributes.position = createPositionAttribute(1)
    delete attributes.normal

    expect(geometry.vertexCount).toBe(3)
    expect(geometry.drawCount).toBe(3)
    expect(geometry.indexed).toBe(false)
    expect(geometry.topology).toBe('triangles')
    expect(geometry.getAttributeNames()).toEqual(['position', 'normal'])
    expect(geometry.getAttribute('position')).toBe(position)
    expect(geometry.getAttribute('normal')).toBe(normal)
    expect(geometry.copyIndices()).toBeNull()
  })

  /**
   * 验证属性名称数组不是内部 Map 的可变视图或共享缓存。
   *
   * 保护的错误实现：重复返回同一个数组，使调用者能够影响下一次查询结果。
   */
  it('getAttributeNames 每次返回新数组', () => {
    const geometry = new Geometry({
      attributes: {
        position: createPositionAttribute(3),
        normal: createPositionAttribute(3)
      }
    })

    const first = geometry.getAttributeNames()
    const second = geometry.getAttributeNames()

    expect(first).toEqual(['position', 'normal'])
    expect(first).not.toBe(second)
  })

  /**
   * 验证索引数据在构造时被复制，并成为 indexed drawCount 的来源。
   *
   * 保护的错误实现：
   *
   * - 保存调用者的 indices 引用；
   * - indexed Geometry 仍使用 position.count 作为 drawCount。
   */
  it('复制 indices 并根据 index count 设置 drawCount', () => {
    const indices = new Uint16Array([0, 2, 1])
    const geometry = new Geometry({
      attributes: {
        position: createPositionAttribute(3)
      },
      indices
    })

    indices[0] = 2

    expect(geometry.indexed).toBe(true)
    expect(geometry.vertexCount).toBe(3)
    expect(geometry.drawCount).toBe(3)
    expect(geometry.copyIndices()).toEqual(new Uint16Array([0, 2, 1]))
  })

  /**
   * 验证索引查询既保留具体 TypedArray 类型，也不泄漏内部可变数组。
   *
   * 保护的错误实现：直接返回 indicesValue，或统一转换成另一种 index 类型。
   */
  it('每次 copyIndices 都返回相同类型的新实例', () => {
    const geometry = new Geometry({
      attributes: {
        position: createPositionAttribute(3)
      },
      indices: new Uint8Array([0, 1, 2])
    })

    const first = geometry.copyIndices()
    const second = geometry.copyIndices()

    expect(first).toBeInstanceOf(Uint8Array)
    expect(second).toBeInstanceOf(Uint8Array)
    expect(first).toEqual(new Uint8Array([0, 1, 2]))
    expect(first).not.toBe(second)
  })

  /**
   * CPU Geometry 接受 Uint32 索引，不负责查询 OES_element_index_uint。
   *
   * 保护的错误实现：让 CPU Geometry 依赖 WebGL context 或浏览器扩展。
   * 是否直接上传或安全降级到 Uint16 由后续 WebGL1GeometryManager 决定。
   */
  it('接受 Uint32 CPU indices，而不在 CPU Geometry 中判断 WebGL 扩展', () => {
    const geometry = new Geometry({
      attributes: {
        position: createPositionAttribute(3)
      },
      indices: new Uint32Array([0, 1, 2])
    })

    expect(geometry.copyIndices()).toEqual(new Uint32Array([0, 1, 2]))
  })

  /**
   * position 是 Geometry 确定 vertexCount 的基准。
   *
   * 保护的错误实现：随意选择第一个属性作为顶点数量来源，使属性插入顺序改变语义。
   */
  it('拒绝缺少 position attribute 的 Geometry', () => {
    expect(
      () =>
        new Geometry({
          attributes: {
            normal: createPositionAttribute(3)
          }
        })
    ).toThrow(InvalidGeometryError)
  })

  /**
   * 每个逐顶点属性必须与 position 一一对应。
   *
   * 保护的错误实现：只验证 position，自相矛盾的 normal/uv 数据直到 draw 时才暴露。
   */
  it('拒绝不同 attribute count', () => {
    expect(
      () =>
        new Geometry({
          attributes: {
            position: createPositionAttribute(3),
            normal: createPositionAttribute(4)
          }
        })
    ).toThrow(InvalidGeometryError)
  })

  /**
   * VertexAttribute 可以表示空数据，但可绘制 Geometry 必须至少包含一个 position。
   *
   * 保护的错误实现：因为零能被任意 itemSize 整除而错误接受空 Geometry。
   */
  it('拒绝空 position attribute', () => {
    expect(
      () =>
        new Geometry({
          attributes: {
            position: createPositionAttribute(0)
          }
        })
    ).toThrow(InvalidGeometryError)
  })

  /**
   * 所有索引都必须位于 [0, vertexCount)。
   *
   * 保护的错误实现：使用 `index > vertexCount`，错误放过恰好等于 vertexCount
   * 的越界索引。
   */
  it('拒绝越过 vertexCount 的 index', () => {
    expect(
      () =>
        new Geometry({
          attributes: {
            position: createPositionAttribute(3)
          },
          indices: new Uint16Array([0, 3, 1])
        })
    ).toThrow(InvalidGeometryError)
  })
})

const invalidTopologyCases: ReadonlyArray<{
  readonly topology: PrimitiveTopology
  readonly vertexCount: number
}> = [
  {
    topology: 'triangles',
    vertexCount: 4
  },
  {
    topology: 'lines',
    vertexCount: 3
  },
  {
    topology: 'line-strip',
    vertexCount: 1
  },
  {
    topology: 'triangle-strip',
    vertexCount: 2
  }
]

const validTopologyCases: ReadonlyArray<{
  readonly topology: PrimitiveTopology
  readonly vertexCount: number
}> = [
  {
    topology: 'triangles',
    vertexCount: 3
  },
  {
    topology: 'lines',
    vertexCount: 4
  },
  {
    topology: 'line-strip',
    vertexCount: 2
  },
  {
    topology: 'triangle-strip',
    vertexCount: 3
  }
]

/**
 * 验证 topology 与实际 drawCount 之间的契约。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][geometry-draw-count-validation]
 *
 * 非索引 Geometry 的 drawCount 来自 position.count；索引 Geometry 的 drawCount
 * 来自 indices.length。拓扑验证必须使用最终 drawCount，不能固定使用 vertexCount。
 */
describe('Geometry topology and draw count', () => {
  /**
   * TypeScript 调用者只能传入 PrimitiveTopology 联合类型中的成员，但 JavaScript、
   * JSON 数据或不安全的类型断言仍可能在运行时越过这层静态约束。
   *
   * 保护的错误实现：穷尽 switch 没有 default 分支，导致未知 topology 静默通过
   * 构造验证并一直传播到后端 draw 阶段。
   */
  it('运行时拒绝 PrimitiveTopology 联合类型之外的值', () => {
    const unsupportedTopology = 'points' as unknown as PrimitiveTopology

    expect(
      () =>
        new Geometry({
          attributes: {
            position: createPositionAttribute(3)
          },
          topology: unsupportedTopology
        })
    ).toThrow(ExhaustiveMatchError)
  })

  /**
   * triangles/lines 使用独立分组，strip 则要求能够至少产生一个 primitive。
   *
   * 保护的错误实现：只验证 count 大于零，不验证分组余数或 strip 最小数量。
   */
  it.each(invalidTopologyCases)(
    '拒绝不满足 $topology 分组要求的 $vertexCount 个顶点',
    ({ topology, vertexCount }) => {
      expect(
        () =>
          new Geometry({
            attributes: {
              position: createPositionAttribute(vertexCount)
            },
            topology
          })
      ).toThrow(InvalidGeometryError)
    }
  )

  /**
   * 验证每种受支持 topology 的最小或完整合法分组。
   *
   * 保护的错误实现：把 strip 错误地套用普通 lines/triangles 的整除规则。
   */
  it.each(validTopologyCases)(
    '接受满足 $topology 分组要求的 $vertexCount 个顶点',
    ({ topology, vertexCount }) => {
      const geometry = new Geometry({
        attributes: {
          position: createPositionAttribute(vertexCount)
        },
        topology
      })

      expect(geometry.topology).toBe(topology)
      expect(geometry.drawCount).toBe(vertexCount)
    }
  )

  /**
   * 四个 position 顶点本身不能组成完整 triangles，但三个索引可以。
   *
   * 保护的错误实现：indexed Geometry 仍拿 vertexCount=4 验证 topology，
   * 因而拒绝本来合法的三个索引。
   */
  it('indexed Geometry 使用 index count 验证 topology', () => {
    const geometry = new Geometry({
      attributes: {
        position: createPositionAttribute(4)
      },
      indices: new Uint16Array([0, 1, 2]),
      topology: 'triangles'
    })

    expect(geometry.vertexCount).toBe(4)
    expect(geometry.drawCount).toBe(3)
  })

  /**
   * position 顶点数量合法不代表索引 drawCount 一定合法。
   *
   * 保护的错误实现：只验证 vertexCount=3，错误接受只有两个索引的 triangles draw。
   */
  it('拒绝不满足 topology 分组要求的 index count', () => {
    expect(
      () =>
        new Geometry({
          attributes: {
            position: createPositionAttribute(3)
          },
          indices: new Uint16Array([0, 1]),
          topology: 'triangles'
        })
    ).toThrow(InvalidGeometryError)
  })
})

/**
 * 验证 Geometry 的 Resource 生命周期以及 CPU/GPU 所有权边界。
 *
 * @remarks
 * [DESIGN-WEIGHT:2][geometry-cpu-gpu-boundary]
 *
 * Geometry 只描述 CPU 数据。后续每个 WebGL1Backend/context 的 Manager 独立持有
 * GPU buffer，并通过 Resource dispose listener 删除自己的 GPU 表示。
 */
describe('Geometry disposal and CPU/GPU boundary', () => {
  /**
   * 保护的错误实现：把旧 Mesh/WebGLRenderer 路径中的 GPU 创建、绑定或动态更新
   * 职责重新塞回 CPU Geometry。
   */
  it('对象不暴露 WebGL handle、bind、draw 或动态更新字段', () => {
    const geometry = new Geometry({
      attributes: {
        position: createPositionAttribute(3)
      }
    })

    expect('gl' in geometry).toBe(false)
    expect('buffer' in geometry).toBe(false)
    expect('vao' in geometry).toBe(false)
    expect('bind' in geometry).toBe(false)
    expect('draw' in geometry).toBe(false)
    expect('updateAttribute' in geometry).toBe(false)
    expect('revision' in geometry).toBe(false)
    expect('usage' in geometry).toBe(false)
  })

  /**
   * Geometry 进入 disposed 状态后，调用者不能继续读取已经释放的 CPU 数据。
   *
   * 保护的错误实现：只有部分方法调用 assertUsable()，导致 dispose 后仍能从某个
   * getter 或复制方法取得残留数据。
   */
  it('dispose 后拒绝查询 CPU Geometry 数据', () => {
    const geometry = new Geometry({
      attributes: {
        position: createPositionAttribute(3)
      },
      indices: new Uint16Array([0, 1, 2])
    })

    geometry.dispose()

    expect(geometry.disposed).toBe(true)
    expect(() => geometry.vertexCount).toThrow(ResourceDisposedError)
    expect(() => geometry.drawCount).toThrow(ResourceDisposedError)
    expect(() => geometry.indexed).toThrow(ResourceDisposedError)
    expect(() => geometry.topology).toThrow(ResourceDisposedError)
    expect(() => geometry.getAttributeNames()).toThrow(ResourceDisposedError)
    expect(() => geometry.getAttribute('position')).toThrow(ResourceDisposedError)
    expect(() => geometry.copyIndices()).toThrow(ResourceDisposedError)
  })
})
