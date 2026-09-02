import { mat4, quat, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import { Transform } from '@/rendering/scene/Transform'

/**
 * 验证 Transform 的公开契约，而不是它使用 vec3、quat 或 mat4 的内部实现细节。
 *
 * @remarks
 * 每个测试都针对一种可能的生产错误：
 *
 * - 错误的默认 TRS；
 * - getter 泄漏内部 TypedArray；
 * - 无实际变化却错误增加 version；
 * - binary64 输入和 Float32 存储直接比较造成虚假变化；
 * - 一次 setter 重复增加 version；
 * - 把矩阵缓存状态错误地合并进公开 version；
 * - 把弧度错误地当成角度；
 * - 把内部矩阵缓存直接暴露给调用者。
 */
describe('Transform', () => {
  /**
   * 保护的错误实现：position、rotation、scale 或 local matrix 使用了错误默认值，
   * 或者 constructor 在没有任何真实修改时增加了 version。
   */
  it('使用 identity TRS 和 version 0 初始化', () => {
    // Given：创建没有任何显式 TRS 修改的 Transform。
    const transform = new Transform()
    const localMatrix = mat4.create()

    // When：第一次请求 local matrix。
    transform.copyLocalMatrixTo(localMatrix)

    // Then：默认 TRS 必须共同生成 identity matrix。
    expect(transform.position).toEqual([0, 0, 0])
    expect(transform.rotation).toEqual([0, 0, 0])
    expect(transform.scale).toEqual([1, 1, 1])
    expect(transform.version).toBe(0)
    expect(Array.from(localMatrix)).toEqual(Array.from(mat4.create()))
  })

  /**
   * 保护的错误实现：getter 直接返回内部 vec3，使调用者可以绕过 setter 修改状态，
   * 从而让 local-matrix dirty flag 和 version 无法感知变化。
   */
  it('每次读取 position、rotation 和 scale 都返回独立副本', () => {
    const transform = new Transform()

    // 每次 getter 都应创建独立 tuple，而不是重复暴露同一个对象。
    expect(transform.position).not.toBe(transform.position)
    expect(transform.rotation).not.toBe(transform.rotation)
    expect(transform.scale).not.toBe(transform.scale)

    // 测试故意突破 readonly 类型并修改返回值，模拟恶意或不谨慎的调用者。
    const returnedPosition = transform.position as unknown as number[]
    const returnedRotation = transform.rotation as unknown as number[]
    const returnedScale = transform.scale as unknown as number[]

    returnedPosition[0] = 100
    returnedRotation[1] = 200
    returnedScale[2] = 300

    // Transform 的内部值必须保持不变。
    expect(transform.position).toEqual([0, 0, 0])
    expect(transform.rotation).toEqual([0, 0, 0])
    expect(transform.scale).toEqual([1, 1, 1])
  })

  /**
   * 保护的错误实现：setter 无条件把缓存标记为 dirty 并增加 version，
   * 导致没有真实变化的每帧赋值触发无意义的世界矩阵更新。
   */
  it('设置相同三元组不增加 version', () => {
    const transform = new Transform()

    transform.setPosition([0, 0, 0])
    transform.setRotation([0, 0, 0])
    transform.setScale([1, 1, 1])

    expect(transform.version).toBe(0)
  })

  /**
   * 验证 JavaScript binary64 输入与 Transform Float32 存储之间的量化边界。
   *
   * @remarks
   * [DESIGN-WEIGHT:3][transform-float32-canonicalization]
   *
   * 保护的错误实现：第一次把 `0.1` 写入 Float32 存储后，内部值变成
   * `0.10000000149011612`；第二次仍拿它与原始 binary64 `0.1` 直接比较，
   * 因而错误认为状态再次发生变化。
   *
   * 测试覆盖 position、rotation 和 scale，防止某个 setter 将来绕过共享的
   * Float32 量化逻辑。
   */
  it('量化为 Float32 后再判断重复小数赋值', () => {
    // Given：三个 setter 都接收不能被 binary32 精确表示的十进制小数。
    const transform = new Transform()
    const position = [0.1, 0.2, 0.3] as const
    const rotation = [0.4, 0.5, 0.6] as const
    const scale = [1.1, 1.2, 1.3] as const

    // When：第一次写入时，三个 setter 分别造成一次真实 Float32 状态变化。
    transform.setPosition(position)
    transform.setRotation(rotation)
    transform.setScale(scale)

    // Then：公开 getter 反映实际 Float32 存储值，每个 setter 恰好增加一次 version。
    expect(transform.position).toEqual([Math.fround(0.1), Math.fround(0.2), Math.fround(0.3)])
    expect(transform.rotation).toEqual([Math.fround(0.4), Math.fround(0.5), Math.fround(0.6)])
    expect(transform.scale).toEqual([Math.fround(1.1), Math.fround(1.2), Math.fround(1.3)])
    expect(transform.version).toBe(3)

    // When：调用者用完全相同的 binary64 输入重复设置。
    transform.setPosition(position)
    transform.setRotation(rotation)
    transform.setScale(scale)

    // Then：量化后的存储值没有变化，version 不能再次增加。
    expect(transform.version).toBe(3)
  })

  /**
   * 保护的错误实现：一个 setter 修改三个分量时增加三次 version，
   * 或者某一种 TRS setter 忘记使矩阵缓存失效。
   */
  it('每次真实的 TRS 修改恰好增加一次 version', () => {
    const transform = new Transform()

    transform.setPosition([2, 3, 4])
    expect(transform.version).toBe(1)

    transform.setRotation([0, Math.PI / 2, 0])
    expect(transform.version).toBe(2)

    transform.setScale([2, 2, 2])
    expect(transform.version).toBe(3)
  })

  /**
   * 验证矩阵缓存状态与对外变化版本是两个独立概念。
   *
   * @remarks
   * [DESIGN-WEIGHT:3][transform-dirty-version-separation]
   *
   * 保护的错误实现：
   *
   * - 在重算 local matrix 时错误增加 version；
   * - 在清除 localMatrixDirty 时错误重置 version；
   * - 把 copy 次数误当成 Transform 状态变化次数。
   *
   * private dirty flag 通过公开行为间接验证，而不是为了测试突破封装。
   */
  it('读取和重算 local matrix 不改变 Transform version', () => {
    const transform = new Transform()
    const output = mat4.create()

    // Given：一次真实 setter 修改使 version 增加，并让矩阵缓存失效。
    transform.setPosition([2, 3, 4])
    expect(transform.version).toBe(1)

    // When：第一次复制需要重算缓存，第二次复制只需要复用缓存。
    transform.copyLocalMatrixTo(output)
    expect(output[12]).toBe(2)
    expect(transform.version).toBe(1)

    transform.copyLocalMatrixTo(output)
    expect(output[12]).toBe(2)
    expect(transform.version).toBe(1)

    // When：新的真实 TRS 修改发生。
    transform.setPosition([5, 3, 4])
    transform.copyLocalMatrixTo(output)

    // Then：version 只因为 setter 增加一次，不因为随后的矩阵重算再次增加。
    expect(output[12]).toBe(5)
    expect(transform.version).toBe(2)
  })

  /**
   * 保护的错误实现：直接把弧度传给以角度为输入的 `quat.fromEuler()`，
   * 或者错误交换 translation、rotation、scale 的组合顺序。
   *
   * @remarks
   * expected 使用手工确定的 90 度旋转，而不是调用 Transform 自己的辅助函数，
   * 避免测试和生产代码共享同一个错误换算公式。
   */
  it('按照弧度输入生成 translation、rotation 和 scale 矩阵', () => {
    const transform = new Transform()
    const actual = mat4.create()
    const expected = mat4.create()
    const expectedRotation = quat.create()

    // Given：平移、绕 Y 轴旋转 90 度并进行 2 倍均匀缩放。
    transform.setPosition([2, 3, 4])
    transform.setRotation([0, Math.PI / 2, 0])
    transform.setScale([2, 2, 2])

    // When：Transform 生成 local matrix。
    transform.copyLocalMatrixTo(actual)

    // Then：结果应等于独立使用 gl-matrix 生成的字面场景结果。
    quat.fromEuler(expectedRotation, 0, 90, 0)
    mat4.fromRotationTranslationScale(
      expected,
      expectedRotation,
      vec3.fromValues(2, 3, 4),
      vec3.fromValues(2, 2, 2)
    )

    expect(Array.from(actual)).toEqual(Array.from(expected))
  })

  /**
   * 保护的错误实现：`copyLocalMatrixTo()` 返回或共享内部 Float32Array，
   * 使调用者能在不增加 version 的情况下破坏 Transform 缓存。
   */
  it('修改之前复制出的矩阵不会污染 Transform 的内部缓存', () => {
    const transform = new Transform()
    const firstOutput = mat4.create()
    const secondOutput = mat4.create()

    transform.setPosition([2, 3, 4])
    transform.copyLocalMatrixTo(firstOutput)

    // 模拟调用者错误修改第一次得到的输出矩阵。
    firstOutput[12] = 999

    // 再次复制必须仍然得到 Transform 自己保存的正确平移。
    transform.copyLocalMatrixTo(secondOutput)

    expect(secondOutput[12]).toBe(2)
    expect(secondOutput[13]).toBe(3)
    expect(secondOutput[14]).toBe(4)
  })
})
