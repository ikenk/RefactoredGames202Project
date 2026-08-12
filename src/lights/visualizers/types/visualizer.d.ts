import type { ILight } from '@/lights/types/light'
import type { MeshRenderer } from '@/renderers/MeshRenderer'

// 注册函数类型
export type VisualizerFactory = (gl: WebGLRenderingContext, light: ILight) => Promise<MeshRenderer>
