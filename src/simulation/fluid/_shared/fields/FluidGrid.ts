/**
 * FluidGrid —— Stable Fluids 求解器使用的 CPU 端 2D 网格数据结构。
 *
 * ─────────────────────────────────────────────────────────────────────
 * 模型范畴
 * ─────────────────────────────────────────────────────────────────────
 *  Phase 1 采用 collocated grid(配置式网格): 标量(p, ρ, ∇·u)与速度的
 *  两个分量(u, v)都存在 cell-center 同一位置。这是 Stam 1999 原始论文
 *  的简化做法,实现门槛低;代价:压力 Poisson 方程会出现"棋盘格"压力
 *  模式(checkerboard pressure mode),即相邻格点压力跳跃但梯度抵消,
 *  数值上看不出。Phase 2 若要严谨可改 MAC staggered grid:u 存于 x-面、
 *  v 存于 y-面、p 存于 cell-center,从根本上消除该模式。
 *
 * ─────────────────────────────────────────────────────────────────────
 * 内存布局与精度
 * ─────────────────────────────────────────────────────────────────────
 *  - 行主序:`index = y * width + x`。与 WebGL2 `texSubImage2D` /
 *    `readPixels` 默认行主序一致,使 CPU↔GPU 字节级对应,upload/readback
 *    无需 swizzle。
 *  - `Float32Array`(IEEE-754 单精度,~7 位十进制有效位):必须与 WebGL2
 *    `R32F`/`RG32F`/`RGBA32F` 浮点纹理同精度,否则 CPU vs GPU 对比测试
 *    会因量化误差(而非算法 bug)假性失败。代价:大数加小数会丢位
 *    (catastrophic cancellation),因此 Jacobi 残差阈值不能小于 ~1e-6。
 *  - VectorGrid 用 SoA(Structure of Arrays):u 与 v 各自独立连续,
 *    分别对应 GPU RG32F 纹理的 R 与 G 通道。AoS 交错布局虽节省一次分配,
 *    但 upload/readback 时需要内存搬运,也不利于 SIMD/cache。
 *
 * ─────────────────────────────────────────────────────────────────────
 * 边界处理责任分离
 * ─────────────────────────────────────────────────────────────────────
 *  本文件只负责"裸数据容器"。任何边界条件(no-slip / free-slip / inflow /
 *  outflow / lid-driven)都由专门的 boundary 算子施加(详见 `boundary.ts`)。
 *  这样:数据结构纯粹、可被任何边界条件复用;clone() 也只是按位拷贝,
 *  不会"顺便"重新施加边界。
 */

/**
 * 标量场 φ(x, y) on cell-center grid。
 *
 * 物理用途:
 *   - 压强 p(单位 Pa,数值仿真常无量纲化)
 *   - 散度 ∇·u(单位 1/s,在不可压缩流中目标值为 0)
 *   - 染料密度 ρ_dye(无量纲浓度,被 advection 推动)
 *   - Poisson 方程的右端项 b
 */
export class ScalarGrid {
  readonly width: number
  readonly height: number

  /** 行主序 Float32 数据,length = width * height。导出便于零拷贝 upload。 */
  readonly data: Float32Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    // Float32Array 默认初始化为 0,对应"零场"的物理零参考态。
    this.data = new Float32Array(width * height)
  }

  /**
   * 读取 (x, y) 处的标量值。caller 必须保证 0 ≤ x < width, 0 ≤ y < height,
   * 越界由 boundary 算子在外部处理(本类不做 clamp,以便上层显式控制)。
   */
  get(x: number, y: number): number {
    return this.data[y * this.width + x]!
  }

  set(x: number, y: number, value: number): void {
    this.data[y * this.width + x] = value
  }

  /** 整场填常数,用于初始化 p ≡ 0、ρ ≡ 1 等。 */
  fill(value: number): void {
    this.data.fill(value)
  }

  /**
   * 深拷贝。Stable Fluids 的算子常需"读旧场写新场",
   * 共享底层 buffer 会让上一帧的格点污染当前帧。
   */
  clone(): ScalarGrid {
    const cloned = new ScalarGrid(this.width, this.height)
    cloned.data.set(this.data)
    return cloned
  }
}

/**
 * 向量场 u(x, y) = (u_x(x, y), u_y(x, y)) on cell-center grid。
 *
 * 物理用途:
 *   - 流体速度场 u(SI 单位 m/s,数值仿真常无量纲化为 grid-cell/timestep)
 *   - 临时中间场(平流后但未投影、压力梯度场等)
 */
export class VectorGrid {
  readonly width: number
  readonly height: number
  /** x 分量(对应 GPU RG32F 的 R 通道),长度 = width * height。 */
  readonly u: Float32Array
  /** y 分量(对应 GPU RG32F 的 G 通道),长度 = width * height。 */
  readonly v: Float32Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.u = new Float32Array(width * height)
    this.v = new Float32Array(width * height)
  }

  getVec(x: number, y: number): [number, number] {
    const index = y * this.width + x
    return [this.u[index]!, this.v[index]!]
  }

  setVec(x: number, y: number, u: number, v: number): void {
    const index = y * this.width + x
    this.u[index] = u
    this.v[index] = v
  }

  /** 深拷贝两个通道。理由同 ScalarGrid.clone()。 */
  clone(): VectorGrid {
    const c = new VectorGrid(this.width, this.height)
    c.u.set(this.u)
    c.v.set(this.v)
    return c
  }
}
