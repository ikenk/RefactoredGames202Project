export class PerlinNoise {
  private perm: number[] = []

  constructor() {
    // 初始化排列表
    for (let i = 0; i < 256; i++) {
      this.perm[i] = Math.floor(Math.random() * 256)
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a)
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }

  /**
   * 在 256 项排列表中进行周期读取，并把构造阶段建立的完整性不变量收口到一处。
   */
  private permutationAt(index: number): number {
    const wrappedIndex = index & 255
    const value = this.perm[wrappedIndex]

    if (value === undefined) {
      throw new RangeError(`[PerlinNoise] permutation index ${wrappedIndex} is not initialized`)
    }

    return value
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255

    x -= Math.floor(x)
    y -= Math.floor(y)

    const u = this.fade(x)
    const v = this.fade(y)

    const A = this.permutationAt(X) + Y
    const AA = this.permutationAt(A)
    const AB = this.permutationAt(A + 1)
    const B = this.permutationAt(X + 1) + Y
    const BA = this.permutationAt(B)
    const BB = this.permutationAt(B + 1)

    return this.lerp(
      v,
      this.lerp(
        u,
        this.grad(this.permutationAt(AA), x, y),
        this.grad(this.permutationAt(BA), x - 1, y)
      ),
      this.lerp(
        u,
        this.grad(this.permutationAt(AB), x, y - 1),
        this.grad(this.permutationAt(BB), x - 1, y - 1)
      )
    )
  }
}
