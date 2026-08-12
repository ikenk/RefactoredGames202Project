import type { mat4 } from 'gl-matrix'
import { Vec3 } from '@/math/types/math'

// ============================================================
//  基础光源（纯粹的光照数据，和阴影无关）
// ============================================================
type LightType = 'directional' | 'point' | 'spot'

export interface ILight {
  type: LightType
  position: Vec3
  radiance: Vec3 // 最终辐射度（所有光源都有）
}

// =============== Deprecated ===============

type LightUp = Vec3

interface LightDir {
  x: number
  y: number
  z: number
}

export interface LightParams {
  radiance: Vec3
  position: Vec3
  direction: LightDir
}

export interface UpdatedLightParamters {
  uLightVP: mat4
  uLightDir: Vec3
}

// export interface Light {
//   mesh: Mesh
//   material: EmissiveMaterial
//   lightPos: LightParams['lightPos']
//   lightDir?: LightParams['lightDir']
//   lightUp?: LightUp
//   fbo: WebGLFramebuffer

//   // Directional Light
//   CalcDirectionalShadingDirection?(): Vec3
//   CalcDirectionalLightVP?(): mat4
//   CalcDirectionalLightMVP?(translate: Vec3, scale: Vec3): mat4
// }
