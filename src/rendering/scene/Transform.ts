import { mat4, quat, vec3 } from 'gl-matrix'

/**
 * Transform 对外暴露的三分量只读值。
 *
 * @remarks
 * getter 每次创建新的 tuple，因此调用者无法持有或修改内部 gl-matrix vec3。
 *
 * 内部 TRS 使用 Float32 存储，因此 getter 返回的是经过 Float32 量化后的数值。
 * 例如，输入的 JavaScript `0.1` 可能读取为 `0.10000000149011612`。
 */
export type Vec3Tuple = readonly [number, number, number]

/** gl-matrix 的 `quat.fromEuler()` 使用角度，而 Transform 的公开 API 使用弧度。 */
const RADIANS_TO_DEGREES = 180 / Math.PI

/**
 * 把公开输入量化为 Float32，并仅在实际存储值发生变化时写入内部 vec3。
 *
 * @param current - Transform 当前保存的三个 Float32 分量。
 * @param next - setter 调用者提供的 JavaScript number 三元组。
 * @returns 发生真实 Float32 存储变化并完成写入时返回 true；否则返回 false。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][transform-float32-canonicalization]
 *
 * JavaScript `number` 使用 IEEE 754 binary64，而 Transform 的 TRS 按 Float32
 * 语义保存。像 `0.1` 这样的数在两种精度下具有不同的实际表示：
 *
 * ```text
 * binary64 输入 0.1
 * → Math.fround()
 * → Float32 值 0.10000000149011612
 * ```
 *
 * 如果直接比较 `current[0]` 和原始 `next[0]`，重复设置 `0.1` 时，`===` 和
 * `Object.is()` 都会返回 false，导致没有真实存储变化却错误增加 version。
 *
 * 这里先量化，再用 `Object.is()` 精确比较，并把同一组量化结果写入内部 vec3。
 * 因此比较语义和写入语义不会分离，也不依赖 TypedArray 赋值时的隐式转换。
 *
 * `Object.is()` 不是 epsilon 近似比较；它采用 JavaScript SameValue 语义，
 * 会把重复的 `NaN` 视为相同，并区分 `+0` 与 `-0`。
 */
function setFloat32ComponentsIfChanged(current: vec3, next: Vec3Tuple): boolean {
  const nextX = Math.fround(next[0])
  const nextY = Math.fround(next[1])
  const nextZ = Math.fround(next[2])

  const unchanged =
    Object.is(current[0], nextX) && Object.is(current[1], nextY) && Object.is(current[2], nextZ)

  if (unchanged) {
    return false
  }

  vec3.set(current, nextX, nextY, nextZ)
  return true
}

/**
 * 保存 SceneNode 的 local translation、rotation、scale 及其矩阵缓存。
 *
 * @remarks
 * Transform 不知道 parent，也不计算世界矩阵。它只负责：
 *
 * - 保存 local TRS；
 * - 在真实修改时增加 `version`；
 * - 延迟重算 local matrix；
 * - 通过复制 API 输出矩阵，避免泄漏内部 Float32Array。
 *
 * rotation 的公开单位固定为弧度，三个分量依次表示 X、Y、Z 欧拉角。
 *
 * [DESIGN-WEIGHT:3][transform-dirty-version-separation]
 *
 * `localMatrixDirty` 与 `version` 故意承担不同职责，不能合并：
 *
 * - `localMatrixDirty` 是 Transform 内部的缓存状态，表示 local matrix 是否落后
 *   于当前 TRS。读取矩阵并完成重算后，它会恢复为 false。
 * - `version` 是提供给 SceneNode 等外部观察者的单调变化标记。读取或重算矩阵
 *   不会清除它，也不会让它额外增加。
 *
 * 典型时间线：
 *
 * ```text
 * 初始：
 * dirty = true，version = 0
 *
 * 第一次复制矩阵：
 * 重算 identity matrix
 * dirty = false，version 仍为 0
 *
 * 连续修改 position、rotation、scale：
 * dirty 始终为 true
 * version 依次变为 1、2、3
 *
 * 再次复制矩阵：
 * 三次修改合并为一次矩阵重算
 * dirty = false，version 仍为 3
 * ```
 *
 * dirty 可以在任意调用者读取矩阵后变回 false，因此 SceneNode 不能把 dirty
 * 当成持久的变化通知；它必须比较不会因读取而复位的 Transform.version。
 */
export class Transform {
  /**
   * 内部 translation。
   *
   * `readonly` 只禁止把字段改指向另一个 vec3；setter 仍可修改该 vec3 的三个分量。
   */
  private readonly positionValue = vec3.create()

  /** 内部 XYZ 欧拉角，单位为弧度。 */
  private readonly rotationValue = vec3.create()

  /** 内部 scale；默认值为 identity scale `[1, 1, 1]`。 */
  private readonly scaleValue = vec3.fromValues(1, 1, 1)

  /** 最近一次按当前 TRS 生成的 local matrix 缓存。 */
  private readonly localMatrixValue = mat4.create()

  /**
   * 表示 localMatrixValue 是否落后于当前 TRS。
   *
   * @remarks
   * setter 只把它设为 true，不立即执行矩阵运算。矩阵在调用复制 API 时按需更新。
   *
   * 重算完成后它会恢复为 false，因此它只属于 Transform 的内部缓存协议，
   * 不能替代提供给外部观察者的 `version`。
   */
  private localMatrixDirty = true

  /**
   * 每次真实 Float32 TRS 修改恰好增加一次的单调版本号。
   *
   * @remarks
   * [DESIGN-WEIGHT:1][version-safe-integer-horizon]
   *
   * 它不会因为 local matrix 被读取、重算或复制而重置或额外增加。
   * SceneNode 使用它判断当前 world matrix 是否已经包含最新 local transform。
   *
   * JavaScript `number` 在 `Number.MAX_SAFE_INTEGER` 以内可精确表示整数。即使同一个
   * Transform 每秒发生 60 次真实修改，也需要约 476 万年才会到达该上限，因此
   * 当前实时渲染生命周期不引入 BigInt 或回绕协议。
   */
  private versionValue = 0

  /**
   * 获取 translation 的独立只读副本。
   *
   * @returns 新建的、反映内部 Float32 存储值的 `[x, y, z]` tuple。
   */
  get position(): Vec3Tuple {
    return [this.positionValue[0], this.positionValue[1], this.positionValue[2]]
  }

  /**
   * 获取 XYZ 欧拉旋转的独立只读副本，单位为弧度。
   *
   * @returns 新建的、反映内部 Float32 存储值的 `[xRadians, yRadians, zRadians]` tuple。
   */
  get rotation(): Vec3Tuple {
    return [this.rotationValue[0], this.rotationValue[1], this.rotationValue[2]]
  }

  /**
   * 获取 scale 的独立只读副本。
   *
   * @returns 新建的、反映内部 Float32 存储值的 `[x, y, z]` tuple。
   */
  get scale(): Vec3Tuple {
    return [this.scaleValue[0], this.scaleValue[1], this.scaleValue[2]]
  }

  /**
   * 获取 local TRS 的当前版本。
   *
   * @remarks
   * 读取或重算矩阵不会增加 version；只有 setter 造成真实 Float32 存储变化时
   * 才会增加。
   */
  get version(): number {
    return this.versionValue
  }

  /**
   * 设置 local translation。
   *
   * @param position - 新的 `[x, y, z]`；写入前按 Float32 语义量化。
   */
  setPosition(position: Vec3Tuple): void {
    if (!setFloat32ComponentsIfChanged(this.positionValue, position)) {
      return
    }

    this.invalidateLocalMatrix()
  }

  /**
   * 设置 local XYZ 欧拉旋转。
   *
   * @param rotation - 以弧度表示的 `[x, y, z]`；写入前按 Float32 语义量化。
   */
  setRotation(rotation: Vec3Tuple): void {
    if (!setFloat32ComponentsIfChanged(this.rotationValue, rotation)) {
      return
    }

    this.invalidateLocalMatrix()
  }

  /**
   * 设置 local scale。
   *
   * @param scale - 新的 `[x, y, z]` 缩放；写入前按 Float32 语义量化。
   */
  setScale(scale: Vec3Tuple): void {
    if (!setFloat32ComponentsIfChanged(this.scaleValue, scale)) {
      return
    }

    this.invalidateLocalMatrix()
  }

  /**
   * 把当前 local matrix 复制到调用者提供的输出矩阵。
   *
   * @param out - 由调用者拥有并接收结果的 mat4。
   *
   * @remarks
   * 如果 TRS 自上次计算后没有变化，该方法只执行复制；否则先按需更新内部缓存。
   * 调用者修改 `out` 不会污染 Transform 的内部矩阵。
   */
  copyLocalMatrixTo(out: mat4): void {
    this.updateLocalMatrixIfNeeded()
    mat4.copy(out, this.localMatrixValue)
  }

  /**
   * 统一记录一次真实 local TRS 修改。
   *
   * @remarks
   * 一个 setter 无论修改几个分量都只调用一次，因此 version 恰好增加一次。
   * 多次 setter 可以让 dirty 保持 true，但每次真实状态变化仍拥有独立 version。
   */
  private invalidateLocalMatrix(): void {
    this.localMatrixDirty = true
    this.versionValue += 1
  }

  /**
   * 在缓存失效时根据 translation、rotation、scale 重算 local matrix。
   *
   * @remarks
   * 成功重算只会清除 dirty，不会修改 version。version 描述的是 TRS 状态变化，
   * 不是矩阵缓存被读取或计算的次数。
   */
  private updateLocalMatrixIfNeeded(): void {
    if (!this.localMatrixDirty) return

    const rotationQuaternion = quat.create()

    // Transform API 使用弧度；gl-matrix 的 fromEuler 明确要求角度。
    quat.fromEuler(
      rotationQuaternion,
      this.rotationValue[0] * RADIANS_TO_DEGREES,
      this.rotationValue[1] * RADIANS_TO_DEGREES,
      this.rotationValue[2] * RADIANS_TO_DEGREES
    )

    mat4.fromRotationTranslationScale(
      this.localMatrixValue,
      rotationQuaternion,
      this.positionValue,
      this.scaleValue
    )

    this.localMatrixDirty = false
  }
}
