import type { Vec3 } from './math'

export enum CameraType {
  CUBE_SCENE_CAMERA = 'CubeSceneCamera',
  CAVE_SCENE_CAMERA = 'CaveSceneCamera',
  WATER_SCENE_CAMERA = 'WaterSceneCamera'
}
export enum SceneType {
  CUBE_SCENE = 'CubeScene',
  CAVE_SCENE = 'CaveScene'
}
export enum LightType {
  CUBE_LIGHT = 'CubeLight',
  CAVE_LIGHT = 'CaveLight'
}

declare module 'three' {
  interface PerspectiveCamera {
    fbo?: WebGLFramebuffer
  }
}
