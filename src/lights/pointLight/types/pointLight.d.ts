// import { IPointShadow } from '@/lights/shadow/types/shadow'
import { ILight } from '@/lights/types/light'
import { Vec3 } from '@/math/types/math'

// pointLight.d.ts — 不投射阴影的点光源
export interface IPointLight extends ILight {
  readonly type: 'point'
  intensity: number
  color: Vec3 // RGB 颜色（归一化，如 [1, 0.8, 0.6]）

  // 未来可扩展：
  // attenuation: { constant: number; linear: number; quadratic: number }
  // radius: number   // 影响范围
}

// 投射阴影的点光源（未来需要时）
// export interface IShadowPointLight extends ILight, IPointShadow {
//   readonly type: 'point'
//   intensity: number
// }
