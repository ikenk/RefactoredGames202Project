import { TRSTransform } from '@/objects/Mesh'

// 定义3D向量类型
export type Vector3 = [number, number, number]

export interface Transformation {
  translate: Vector3
  scale: Vector3
  rotate: Vector3
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
