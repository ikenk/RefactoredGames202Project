import { Vec3 } from '@/math/types/math'
import { DirectionalLight } from '../DirectionalLight-refactor'

const MOON_POSITION: Vec3 = [200, 300, 200]
const MOON_DIRECTION: Vec3 = [-0.5, -0.7, -0.5]
const MOON_TARGET_DISTANCE = 1000

const MOON_TARGET: Vec3 = [
  MOON_POSITION[0] + MOON_DIRECTION[0] * MOON_TARGET_DISTANCE,
  MOON_POSITION[1] + MOON_DIRECTION[1] * MOON_TARGET_DISTANCE,
  MOON_POSITION[2] + MOON_DIRECTION[2] * MOON_TARGET_DISTANCE
]

// 夜晚（月光，冷蓝，低强度）
export const nightMoon = new DirectionalLight({
  radiance: [0.1, 0.15, 0.3],
  position: MOON_POSITION,
  target: MOON_TARGET,
  up: [0, 1, 0],
  shadowOptions: { shadowConfig: { orthoSize: 300, near: 0.1, far: 2000 } }
})
