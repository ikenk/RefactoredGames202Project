import { describe, expect, it } from 'vitest'

import { InvalidVertexAttributeError } from '@/rendering/core/errors'
import { VertexAttribute, type VertexAttributeData } from '@/rendering/resources/VertexAttribute'

/**
 * 验证 VertexAttribute 建立不可变 CPU 数据快照的公开契约。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][vertex-attribute-immutable-snapshot]
 *
 * 每个测试都通过公开构造函数、只读属性和复制方法观察结果。测试不会读取
 * `dataValue` 等 private 实现，也不会为了测试而给生产类增加额外接口。
 */
describe('VertexAttribute immutable CPU snapshot', () => {
  /**
   * Given：调用者持有一个之后仍可修改的 Float32Array。
   * When：用该数组构造 VertexAttribute，随后修改原数组。
   * Then：VertexAttribute 仍返回构造时的数据快照。
   *
   * 保护的错误实现：直接保存传入 TypedArray 引用，使外部修改暗中改变 Geometry。
   */
  it('复制输入数据并计算 count', () => {
    const input = new Float32Array([0, 1, 2, 3, 4, 5])
    const attribute = new VertexAttribute({
      data: input,
      itemSize: 3
    })

    input[0] = 999

    expect(attribute.itemSize).toBe(3)
    expect(attribute.count).toBe(2)
    expect(attribute.normalized).toBe(false)
    expect(attribute.copyData()).toEqual(new Float32Array([0, 1, 2, 3, 4, 5]))
  })

  /**
   * 验证 normalized 的默认值和显式值不会被构造过程丢失。
   *
   * 保护的错误实现：无论输入是什么都固定写入 false。
   */
  it('保留显式 normalized 配置', () => {
    const attribute = new VertexAttribute({
      data: new Uint8Array([0, 127, 255, 64]),
      itemSize: 4,
      normalized: true
    })

    expect(attribute.normalized).toBe(true)
    expect(attribute.count).toBe(1)
  })

  const typedArrayCases: ReadonlyArray<{
    readonly label: string
    readonly data: VertexAttributeData
  }> = [
    {
      label: 'Float32Array',
      data: new Float32Array([1, 2, 3, 4])
    },
    {
      label: 'Int8Array',
      data: new Int8Array([1, 2, 3, 4])
    },
    {
      label: 'Uint8Array',
      data: new Uint8Array([1, 2, 3, 4])
    },
    {
      label: 'Int16Array',
      data: new Int16Array([1, 2, 3, 4])
    },
    {
      label: 'Uint16Array',
      data: new Uint16Array([1, 2, 3, 4])
    }
  ]

  /**
   * 验证 WebGL1 顶点输入支持的每一种 CPU TypedArray 都保留自己的具体类型，
   * 并且每次读取都取得新的 backing storage。
   *
   * 保护的错误实现：
   *
   * - 把所有数据无条件转换成 Float32Array；
   * - 直接返回内部数组；
   * - 缓存并重复返回同一个可变副本。
   */
  it.each(typedArrayCases)('copyData 为 $label 返回同类型的新实例', ({ data }) => {
    const attribute = new VertexAttribute({
      data,
      itemSize: 2
    })

    const first = attribute.copyData()
    const second = attribute.copyData()

    expect(first.constructor).toBe(data.constructor)
    expect(second.constructor).toBe(data.constructor)
    expect(first).toEqual(data)
    expect(first).not.toBe(second)
  })

  /**
   * 验证调用者可以提供已分配好的兼容目标数组。
   *
   * 保护的错误实现：校验通过但没有真正复制数据，或者复制了错误的元素范围。
   */
  it('copyDataTo 写入相同类型和长度的目标数组', () => {
    const attribute = new VertexAttribute({
      data: new Float32Array([1, 2, 3, 4]),
      itemSize: 2
    })
    const target = new Float32Array(4)

    attribute.copyDataTo(target)

    expect(target).toEqual(new Float32Array([1, 2, 3, 4]))
  })

  /**
   * 验证 copyDataTo 不允许悄悄进行数值存储类型转换。
   *
   * 保护的错误实现：只检查 length，然后把 Float32 数据写进 Uint16Array，
   * 导致小数、负数或范围外数据被截断。
   */
  it('copyDataTo 拒绝不同 TypedArray 类型', () => {
    const attribute = new VertexAttribute({
      data: new Float32Array([1, 2, 3, 4]),
      itemSize: 2
    })

    expect(() => attribute.copyDataTo(new Uint16Array(4))).toThrow(InvalidVertexAttributeError)
  })

  /**
   * 验证目标数组必须完整容纳属性快照。
   *
   * 保护的错误实现：允许过短目标并只复制前半部分，产生看似成功的截断数据。
   */
  it('copyDataTo 拒绝不同长度', () => {
    const attribute = new VertexAttribute({
      data: new Float32Array([1, 2, 3, 4]),
      itemSize: 2
    })

    expect(() => attribute.copyDataTo(new Float32Array(3))).toThrow(InvalidVertexAttributeError)
  })

  /**
   * itemSize 表示每个顶点占用的分量数，所以必须是有限的正整数。
   *
   * 保护的错误实现：只判断 truthy，因而错误接受负数、小数或 Infinity。
   */
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    '拒绝非法 itemSize %s',
    (itemSize) => {
      expect(
        () =>
          new VertexAttribute({
            data: new Float32Array([1, 2, 3]),
            itemSize
          })
      ).toThrow(InvalidVertexAttributeError)
    }
  )

  /**
   * 验证数据必须由完整顶点组成。
   *
   * 保护的错误实现：使用 Math.floor(data.length / itemSize) 并静默丢弃尾部分量。
   */
  it('拒绝不能被 itemSize 整除的数据长度', () => {
    expect(
      () =>
        new VertexAttribute({
          data: new Float32Array([1, 2, 3, 4, 5]),
          itemSize: 3
        })
    ).toThrow(InvalidVertexAttributeError)
  })

  /**
   * 空属性在值对象层仍然具有合法布局；是否允许空 position 是 Geometry 的职责。
   *
   * 保护的错误实现：把 Geometry 的“至少一个 position 顶点”限制错误地下沉到
   * VertexAttribute，使该值对象承担场景级语义。
   */
  it('允许长度为零但布局完整的独立属性', () => {
    const attribute = new VertexAttribute({
      data: new Float32Array(),
      itemSize: 3
    })

    expect(attribute.count).toBe(0)
    expect(attribute.copyData()).toEqual(new Float32Array())
  })
})
