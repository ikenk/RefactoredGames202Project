import type { mat3, mat4, vec3 } from 'gl-matrix'
import type { Vec3 } from './math'
import type { UpdatedParamters } from '@/types/MeshRender'

type LightUp = Vec3

interface LightDir {
  x: number
  y: number
  z: number
}

export interface LightParams {
  lightRadiance: Vec3
  lightPos: Vec3
  lightDir: LightDir
}

export interface UpdatedLightParamters extends UpdatedParamters {
  uLightVP: mat4
  uLightDir: Vec3
}

export interface Light {
  mesh: Mesh
  material: EmissiveMaterial
  lightPos: LightParams['lightPos']
  lightDir?: LightParams['lightDir']
  lightUp?: LightUp
  fbo: WebGLFramebuffer

  // Directional Light
  CalcDirectionalShadingDirection?(): Vec3
  CalcDirectionalLightVP?(): mat4
  CalcDirectionalLightMVP?(translate: Vec3, scale: Vec3): mat4
}
