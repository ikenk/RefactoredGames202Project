import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
// import { GUI } from 'dat.gui'
// import { Pane } from 'tweakpane'

/**
 * 场景加载器需要的运行时上下文
 *
 * GUI 选型说明（per-scene 渐进迁移 dat.GUI → Tweakpane）：
 * - 老场景（HW1-4 / FFT Ocean v1-v3）继续用 `gui: GUI`
 * - 新场景（FFT Ocean v4+）用 `pane: Pane`
 * - 两者由 Engine 同时创建，scene loader 按需选用
 */
export interface SceneContext {
  gl: WebGLRenderingContext
  renderer: WebGLRenderer
  camera: PerspectiveCamera
  controls: OrbitControls
}
