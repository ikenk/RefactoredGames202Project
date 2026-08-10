import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerlinNoise } from '@/math/PerlinNoise'

function createIdentityPermutationNoise(): PerlinNoise {
  let nextValue = 0

  vi.spyOn(Math, 'random').mockImplementation(() => nextValue++ / 256)

  return new PerlinNoise()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PerlinNoise', () => {
  it('在固定排列表下保持现有二维噪声结果', () => {
    const noise = createIdentityPermutationNoise()

    expect(noise.noise(0.25, 0.5)).toBeCloseTo(0.0517578125, 12)
  })

  it('每隔 256 个格点重复同一个噪声值', () => {
    const noise = createIdentityPermutationNoise()

    expect(noise.noise(256.25, 0.5)).toBeCloseTo(noise.noise(0.25, 0.5), 12)
  })
})
