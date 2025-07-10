export type CameraType = 'CubeSceneCamera' | 'CaveSceneCamera'
export type SceneType = 'CubeScene' | 'CaveScene'
export type LightType = 'CubeLight' | 'CaveLight'

interface LightDir {
  x: number
  y: number
  z: number
}

export interface LightParams {
  lightRadiance: [number, number, number]
  lightPos: [number, number, number]
  lightDir: LightDir
}

declare module 'three' {
  interface PerspectiveCamera {
    fbo?: FBO
  }
}
