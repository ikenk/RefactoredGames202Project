import { Vec3 } from '@/math/types/math'

export class Transform {
  private _translation: Vec3
  private _rotation: Vec3
  private _scale: Vec3

  constructor(translation: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    this._translation = translation
    this._rotation = rotation
    this._scale = scale
  }

  /** 单位变换（原点、无旋转、原始大小） */
  static identity(): Transform {
    return new Transform()
  }

  /** 读取位移（返回引用，外部可修改分量） */
  get translation(): Vec3 {
    return this._translation
  }
  get rotation(): Vec3 {
    return this._rotation
  }
  get scale(): Vec3 {
    return this._scale
  }

  /** 值拷贝设置位移 */
  setTranslation(v: Vec3) {
    this._translation[0] = v[0]
    this._translation[1] = v[1]
    this._translation[2] = v[2]
  }

  /** 值拷贝设置旋转 */
  setRotation(v: Vec3) {
    this._rotation[0] = v[0]
    this._rotation[1] = v[1]
    this._rotation[2] = v[2]
  }

  /** 值拷贝设置缩放 */
  setScale(v: Vec3) {
    this._scale[0] = v[0]
    this._scale[1] = v[1]
    this._scale[2] = v[2]
  }
}
