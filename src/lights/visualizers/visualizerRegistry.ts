import { ILight } from '../types/light'
import { VisualizerFactory } from './types/visualizer'

const registry = new Map<string, VisualizerFactory>()

export function registerVisualizer(type: string, factory: VisualizerFactory): void {
  if (registry.has(type)) {
    console.warn(`[VisualizerRegistry] "${type}" already registered, overwriting`)
    return
  }

  registry.set(type, factory)
}

export async function createLightVisualizer(
  gl: WebGLRenderingContext,
  type: string,
  light: ILight
) {
  const factory = registry.get(type)
  if (!factory) {
    throw new Error(`[VisualizerRegistry] No visualizer registered for light type: "${light.type}"`)
  }

  return factory(gl, light)
}
