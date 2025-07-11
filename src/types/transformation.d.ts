import { TRSTransform } from '@/objects/Mesh'
import { Vec3 } from './math'

export interface Transformation {
  translate: Vec3
  scale: Vec3
  rotate: Vec3
}

export interface TransformationParams {
  modelTransX: Transformation['translate'][0]
  modelTransY: Transformation['translate'][1]
  modelTransZ: Transformation['translate'][2]
  modelScaleX: Transformation['scale'][0]
  modelScaleY: Transformation['scale'][1]
  modelScaleZ: Transformation['scale'][2]
  modelRotateX: Transformation['rotate'][0]
  modelRotateY: Transformation['rotate'][1]
  modelRotateZ: Transformation['rotate'][2]
}
