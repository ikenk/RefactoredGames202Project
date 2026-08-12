import type { ShadowConfig } from '@/renderers/passes/shadow/types/shadow'
import { Vec3 } from '@/math/types/math'

/**
 * 光照朝向：二选一
 *
 * - target 模式：光始终指向 target，改 position 时 direction 自动更新
 * - direction 模式：固定方向，内部自动算出 target = position + direction
 */
// type LightAimMode = { target: Vec3; direction?: never } | { direction: Vec3; target?: never }

/**
 * 方向光构造参数
 */
type DirectionalLightParams =
  // LightAimMode &
  {
    radiance: Vec3
    position: Vec3
    target: Vec3
    /** lookAt 的 up 向量，默认 [0, 1, 0]。光照方向接近 Y 轴时需手动改为 [0, 0, 1] */
    up?: Vec3
    worldSize?: number // 世界坐标系下的光源物理大小，PCSS 用。默认 5.0
    shadowOptions?: DirectionalLightShadowOptions
  }

export interface DirectionalLightShadowOptions {
  castShadow?: boolean // 默认 true
  shadowResolution?: number // 默认 2048
  shadowConfig?: Partial<ShadowConfig> // 默认 DEFAULT_SHADOW_CONFIG
}
