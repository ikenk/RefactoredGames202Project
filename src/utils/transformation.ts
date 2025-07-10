import { TransformationParams } from '@/types/transformation'

export function setTransform(
  t_x: number,
  t_y: number,
  t_z: number,
  s_x: number,
  s_y: number,
  s_z: number,
  r_x: number = 0,
  r_y: number = 0,
  r_z: number = 0
): TransformationParams {
  return {
    modelTransX: t_x,
    modelTransY: t_y,
    modelTransZ: t_z,
    modelScaleX: s_x,
    modelScaleY: s_y,
    modelScaleZ: s_z,
    modelRotateX: r_x,
    modelRotateY: r_y,
    modelRotateZ: r_z
  }
}
