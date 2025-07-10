import type { mat4 } from 'gl-matrix'
import type { Vec3 } from './math'

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

export interface Light {
  mesh: Mesh
  mat: EmissiveMaterial
  lightPos: LightParams['lightPos']
  lightDir: LightParams['lightDir']
  lightUp: LightUp
  fbo: FBO

  CalcShadingDirection(): Vec3
  CalcLightVP(): mat4
}
