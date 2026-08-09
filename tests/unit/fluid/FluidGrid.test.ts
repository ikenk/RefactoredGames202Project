/**
 * FluidGrid 单元测试。
 *
 * 守护意图:
 * - 行主序索引 `i = y * width + x` 与 GPU `texSubImage2D` / `readPixels` 默认布局一致。
 *   一旦行主序错为列主序,CPU↔GPU 对比测试会全军覆没,但单 op 单测仍可能通过。
 * - clone() 必须深拷贝 —— Stable Fluids 的算子常需"读旧场写新场",别名 bug 会让上一帧
 *   的格点污染当前帧,产生看似"算法不稳定"的假象。
 * - VectorGrid 用 SoA(u, v 各自 Float32Array)而非交错存 —— 与 GPU RG32F 纹理
 *   通道布局对齐,便于零拷贝 upload/readback。
 *
 * 精度注意:
 * - 全部用 Float32(`Float32Array`),与 WebGL2 浮点纹理保持同精度。
 *   这意味着 `g.set(x, y, 3.14)` 后 `g.get(x, y)` 不一定严格等于 3.14
 *   (3.14 在 Float32 下为 3.140000104904175...)。本组测试故意只用整数和 0.5 等
 *   可精确表示的值,避免精度噪声混入"行主序"等结构性测试。
 */
import { describe, it, expect } from 'vitest'
import { ScalarGrid, VectorGrid } from '@/simulation/fluid/_shared/fields/FluidGrid'

describe('ScalarGrid', () => {
  it('构造时默认填充 0(对应"未初始化即零场"的物理零参考态)', () => {
    const g = new ScalarGrid(4, 3)
    expect(g.width).toBe(4)
    expect(g.height).toBe(3)
    expect(g.data.length).toBe(12)
    expect(g.data.every((item) => item === 0)).toBe(true)
  })

  it('get/set 必须按行主序索引(y * width + x),与 GPU texel 布局一致', () => {
    const g = new ScalarGrid(4, 3)
    g.set(2, 1, 7)
    expect(g.get(2, 1)).toBe(7)
    expect(g.data[1 * 4 + 2]).toBe(7)
  })

  it('clone() 深拷贝(防止"读旧场写新场"算子产生别名)', () => {
    const g = new ScalarGrid(2, 2)
    g.set(0, 0, 5)
    const c = g.clone()
    g.set(0, 0, 10)
    expect(c.get(0, 0)).toBe(5)
  })

  it('fill() 应按常数值填充整个场(用于初始化常数场,如 p ≡ 0、ρ ≡ 1)', () => {
    const g = new ScalarGrid(2, 2)
    g.fill(0.5)
    expect(g.data.every((item) => item === 0.5)).toBe(true)
  })
})

describe('VectorGrid', () => {
  it('构造时 u, v 两通道都为 0(零速度场即静止流体)', () => {
    const g = new VectorGrid(2, 2)
    expect(g.u.every((v) => v === 0)).toBe(true)
    expect(g.v.every((v) => v === 0)).toBe(true)
  })

  it('setVec/getVec 正确读写两个分量(对应 RG 纹理的 R↔u, G↔v)', () => {
    const g = new VectorGrid(3, 3)
    g.setVec(1, 1, 0.5, -0.25)
    const [u, v] = g.getVec(1, 1)
    expect(u).toBe(0.5)
    expect(v).toBe(-0.25)
  })

  it('u 与 v 是相互独立的 Float32Array(SoA 布局,与 GPU 通道分离一致)', () => {
    const g = new VectorGrid(2, 2)
    expect(g.u).not.toBe(g.v)
    expect(g.u.length).toBe(g.width * g.height)
    expect(g.v.length).toBe(g.width * g.height)
  })

  it('clone() 深拷贝 u 和 v 两个通道', () => {
    const g = new VectorGrid(2, 2)
    g.setVec(0, 0, 1, 2)
    const c = g.clone()
    g.setVec(0, 0, 99, 99)
    expect(c.getVec(0, 0)).toEqual([1, 2])
  })
})
