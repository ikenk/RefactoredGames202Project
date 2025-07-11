import type { mat4 } from 'gl-matrix'
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
  mat: EmissiveMaterial
  lightPos: LightParams['lightPos']
  lightDir: LightParams['lightDir']
  lightUp: LightUp
  fbo: WebGLFramebuffer

  CalcShadingDirection(): Vec3
  CalcLightVP(): mat4
}
