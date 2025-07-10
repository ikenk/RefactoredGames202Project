import type { Vec3 } from './math'

export type CameraType = 'CubeSceneCamera' | 'CaveSceneCamera'
export type SceneType = 'CubeScene' | 'CaveScene'
export type LightType = 'CubeLight' | 'CaveLight'

declare module 'three' {
  interface PerspectiveCamera {
    fbo?: FBO
  }
}
