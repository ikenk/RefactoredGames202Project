import { InvalidVertexAttributeError } from '@/rendering/core/errors'

/**
 * WebGL1 `vertexAttribPointer()` 可以直接解释的 CPU 顶点分量存储类型。
 *
 * @remarks
 * 本阶段不加入 Int32Array、Uint32Array 或 Float64Array。Uint32Array 只用于
 * Geometry index data，并由后续 GeometryManager 结合 WebGL1 扩展能力处理。
 */
export type VertexAttributeData = Float32Array | Int8Array | Uint8Array | Int16Array | Uint16Array

/** VertexAttribute 尚未被 Geometry 赋予 position/normal 等语义名称时使用的诊断标签。 */
const ATTRIBUTE_DIAGNOSTIC_NAME = 'attribute'

/**
 * 创建具有独立 backing storage 的同类型 TypedArray 副本。
 *
 * @param data - 需要建立快照的顶点属性数据。
 * @returns 与输入具有相同具体 TypedArray 类型的新实例。
 *
 * @remarks
 * 该函数是模块内部的数据复制原语，不是 VertexAttribute 的领域行为，因此不作为
 * public 或 protected 方法暴露。显式列出支持类型，也避免通过宽泛构造器断言掩盖
 * 意外传入的 TypedArray 类型。
 */
function copyVertexAttributeData(data: VertexAttributeData): VertexAttributeData {
  if (data instanceof Float32Array) return new Float32Array(data)
  if (data instanceof Int8Array) return new Int8Array(data)
  if (data instanceof Uint8Array) return new Uint8Array(data)
  if (data instanceof Int16Array) return new Int16Array(data)
  if (data instanceof Uint16Array) return new Uint16Array(data)

  throw new InvalidVertexAttributeError(
    ATTRIBUTE_DIAGNOSTIC_NAME,
    'uses an unsupported TypedArray type'
  )
}

/**
 * 一个不可变的 CPU 顶点属性值对象。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][vertex-attribute-immutable-snapshot]
 *
 * VertexAttribute 把调用者提供的 TypedArray 复制到私有存储中，并且只通过复制 API
 * 输出数据。这样，构造后的 Geometry 不会因为调用者继续修改原数组而悄悄变化；
 * 不同 WebGL context 在不同时刻上传同一个 Geometry 时也会观察到同一份 CPU 数据。
 *
 * VertexAttribute 本身不继承 Resource，因为它不是独立的 GPU cache key，也没有单独
 * 的释放生命周期。Geometry 组合多个 VertexAttribute，并作为整体参与 Resource
 * 生命周期和后续 per-context GPU 缓存。
 */
export class VertexAttribute {
  /** 每个顶点由多少个连续分量组成。 */
  public readonly itemSize: number

  /**
   * WebGL 读取整数 TypedArray 时是否把整数范围归一化到浮点范围。
   *
   * @remarks
   * 该字段只描述顶点输入布局；VertexAttribute 自己不调用 WebGL API。
   */
  public readonly normalized: boolean

  /** 构造时建立、永不向调用者直接暴露的 CPU 数据快照。 */
  private readonly dataValue: VertexAttributeData

  /**
   * 创建一个不可变顶点属性。
   *
   * @param options.data - 需要复制保存的 CPU TypedArray。
   * @param options.itemSize - 每个顶点的分量数量。
   * @param options.normalized - 整数属性是否在 GPU 读取时归一化；默认 false。
   *
   * @throws {@link InvalidVertexAttributeError}
   * itemSize 不是有限正整数、数据长度不能被 itemSize 整除，或运行时传入不受支持
   * 的 TypedArray 时抛出。
   */
  constructor(options: {
    readonly data: VertexAttributeData
    readonly itemSize: number
    readonly normalized?: boolean
  }) {
    const { data, itemSize, normalized = false } = options

    if (!Number.isInteger(itemSize) || itemSize <= 0) {
      throw new InvalidVertexAttributeError(
        ATTRIBUTE_DIAGNOSTIC_NAME,
        `itemSize must be a positive integer; received ${String(itemSize)}`
      )
    }

    if (data.length % itemSize !== 0) {
      throw new InvalidVertexAttributeError(
        ATTRIBUTE_DIAGNOSTIC_NAME,
        `data length ${data.length} is not divisible by itemSize ${itemSize}`
      )
    }

    this.dataValue = copyVertexAttributeData(data)
    this.itemSize = itemSize
    this.normalized = normalized
  }

  /**
   * 获取该属性包含的完整顶点数量。
   *
   * @returns `data.length / itemSize`。构造函数已经保证结果为非负整数。
   */
  get count(): number {
    return this.dataValue.length / this.itemSize
  }

  /**
   * 复制完整属性数据。
   *
   * @returns 与内部存储具有相同具体 TypedArray 类型的新实例。
   *
   * @remarks
   * 返回副本而不是内部引用，是 VertexAttribute 对外不可变契约的一部分。调用者可以
   * 修改返回数组，但该修改不会影响下一次 copyData() 或使用本属性的 Geometry。
   */
  copyData(): VertexAttributeData {
    return copyVertexAttributeData(this.dataValue)
  }

  /**
   * 把完整属性快照复制到调用者提供的目标数组。
   *
   * @param out - 与内部数据具有相同具体 TypedArray constructor 和长度的目标数组。
   *
   * @throws {@link InvalidVertexAttributeError}
   * 目标数组类型或长度不同。如果抛错，不会执行部分复制。
   *
   * @remarks
   * 要求相同 constructor 可以避免 Float32Array 到整数数组等隐式数值转换；
   * 要求相同 length 可以避免静默截断。
   */
  copyDataTo(out: VertexAttributeData): void {
    if (out.constructor !== this.dataValue.constructor) {
      throw new InvalidVertexAttributeError(
        ATTRIBUTE_DIAGNOSTIC_NAME,
        `copy target type ${out.constructor.name} does not match source type ${this.dataValue.constructor.name}`
      )
    }

    if (out.length !== this.dataValue.length) {
      throw new InvalidVertexAttributeError(
        ATTRIBUTE_DIAGNOSTIC_NAME,
        `copy target length ${out.length} does not match source length ${this.dataValue.length}`
      )
    }

    out.set(this.dataValue)
  }
}
