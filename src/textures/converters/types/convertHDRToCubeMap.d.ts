import { TypedArray } from 'three'

/** three.js 的 Source.data 是 any；DataTexture 场景下它是这个形状 */
export interface HDRSourceData {
  data: TypedArray
  width: number
  height: number
}
