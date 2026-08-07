/**
 * useTiering — 按 descriptor.tier 装配 Tweakpane 控件并分发副作用
 *
 * 与 v3 (dat.GUI) 版的主要差异：
 * - 控件创建用 `folder.addBinding(target, key, params)` 代替 `folder.add(...)`
 * - 事件监听用 `binding.on('change', e => ...)` 代替 `controller.onChange(...)`
 *   - e.value 是新值（等价于 dat.GUI onChange 的 v）
 *   - e.last 标记是否是连续交互的"最后一次"（拖动结束 / blur 等）
 *     ← 这正是替代 onFinishChange 的官方机制，无需自己防抖
 * - color 控件：Tweakpane 期望 {r,g,b} 对象，我们的 config 是 Vec3 数组，
 *   所以用 proxy 对象桥接，每次 change 时手动同步回原数组
 */

import type { Pane, FolderApi } from 'tweakpane'
import { UniformEntry, UniformType } from '@/materials/types/Material'
import type { Vec3 } from '@/math/types/math'
import type { FFTOceanGUIDeps } from '../../types/setup-v4'
import type {
  ControlDescriptor,
  T1Descriptor,
  T2ContributeDescriptor,
  T2ChoppinessDescriptor,
  T2FoamDescriptor,
  T3SpectrumDescriptor
} from '../descriptors'

function makeT1UniformEntry(widget: T1Descriptor['widget'], v: number | Vec3): UniformEntry {
  switch (widget) {
    case 'slider':
    case 'log-slider':
      return { type: UniformType.ONE_F, value: v as number }
    case 'color':
      return { type: UniformType.THREE_FV, value: v as Vec3 }
  }
}

type Container = Pane | FolderApi

export function useTiering(deps: FFTOceanGUIDeps) {
  const mat = deps.config.materialConfig as Record<string, unknown>
  const cascade = deps.config.oceanParamsCascade

  function dispatchT1(d: T1Descriptor, v: number | Vec3): void {
    deps.oceanRenderer.updateMaterialUniforms({
      [d.uname]: makeT1UniformEntry(d.widget, v)
    })
  }

  function dispatchT2Contribute(d: T2ContributeDescriptor, v: number): void {
    deps.oceanRenderer.updateMaterialUniforms({
      [`uLayerContribute${d.layerIndex}`]: { type: UniformType.ONE_F, value: v }
    })
  }

  function dispatchT2Choppiness(d: T2ChoppinessDescriptor): void {
    const layer = cascade[d.layerIndex]
    if (!layer?.choppiness) return
    deps.computePass.setLayerChoppiness(d.layerIndex, layer.choppiness)
  }

  // function dispatchT2Foam(d: T2FoamDescriptor, v: number): void {
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   const states = (deps.computePass as any).layerStates as
  //     | Array<Record<string, number>>
  //     | undefined
  //   const target = states?.[d.layerIndex]
  //   if (target) target[d.key] = v
  // }

  function dispatchT2Foam(d: T2FoamDescriptor, value: number): void {
    deps.computePass.setLayerFoamParameter(d.layerIndex, d.key, value)
  }

  function dispatchT3Spectrum(d: T3SpectrumDescriptor): void {
    const layer = cascade[d.layerIndex]
    if (!layer) return
    // deps.computePass.rebuildLayerSpectrum(d.layerIndex, layer, deps.spectrum)
    deps.rebuildLayerSpectrum(d.layerIndex)
  }

  function dispatch(d: ControlDescriptor, v: number | Vec3): void {
    switch (d.tier) {
      case 'T1':
        return dispatchT1(d, v)
      case 'T2-contribute':
        return dispatchT2Contribute(d, v as number)
      case 'T2-choppiness':
        return dispatchT2Choppiness(d)
      case 'T2-foam':
        return dispatchT2Foam(d, v as number)
      case 'T3-spectrum':
        return dispatchT3Spectrum(d)
    }
  }

  function resolveBinding(d: ControlDescriptor): {
    target: Record<string, unknown>
    key: string
  } | null {
    switch (d.tier) {
      case 'T1':
        return { target: mat, key: d.key }
      case 'T2-contribute': {
        const layer = cascade[d.layerIndex]
        if (!layer) return null
        return { target: layer as unknown as Record<string, unknown>, key: 'layerContribute' }
      }
      case 'T2-choppiness': {
        const layer = cascade[d.layerIndex]
        if (!layer) return null
        if (!layer.choppiness) layer.choppiness = [1, 1]
        return {
          target: layer.choppiness as unknown as Record<string, unknown>,
          key: String(d.axis)
        }
      }
      case 'T2-foam': {
        const layer = cascade[d.layerIndex]
        if (!layer) return null
        return { target: layer as unknown as Record<string, unknown>, key: d.key }
      }
      case 'T3-spectrum': {
        const layer = cascade[d.layerIndex]
        if (!layer) return null
        if (d.scope) {
          const sp = (layer as unknown as Record<string, unknown>)[d.scope] as
            | Record<string, unknown>
            | undefined
          if (!sp) return null
          return { target: sp, key: d.key }
        }
        return { target: layer as unknown as Record<string, unknown>, key: d.key }
      }
    }
  }

  function addControl(container: Container, d: ControlDescriptor, onAfter?: () => void): void {
    const binding = resolveBinding(d)
    if (!binding) {
      console.warn('[useTiering v4] resolveBinding returned null:', d)
      return
    }
    const { target, key } = binding
    const isT3 = d.tier === 'T3-spectrum'

    // ---- color widget（Vec3 数组 → Tweakpane {r,g,b} proxy）----
    if (d.tier === 'T1' && d.widget === 'color') {
      const arr = (target[key] as Vec3 | undefined) ?? [0, 0, 0]
      const proxy = { value: { r: arr[0], g: arr[1], b: arr[2] } }
      container
        .addBinding(proxy, 'value', {
          label: d.name ?? key,
          color: { type: 'float' }
        })
        .on('change', (e) => {
          const c = e.value as { r: number; g: number; b: number }
          const next: Vec3 = [c.r, c.g, c.b]
          target[key] = next
          dispatch(d, next)
          if (e.last) onAfter?.()
        })
      return
    }

    // ---- log-slider widget ----
    if (d.tier === 'T1' && d.widget === 'log-slider') {
      const initial = (target[key] as number | undefined) ?? 1e-10
      const proxy = { logValue: Math.log10(Math.max(initial, 1e-10)) }
      const range = d.range ?? [-5, -1]
      const step = d.step ?? 0.01
      container
        .addBinding(proxy, 'logValue', {
          label: d.name ?? `${key} (log10)`,
          min: range[0],
          max: range[1],
          step
        })
        .on('change', (e) => {
          const realV = Math.pow(10, e.value)
          target[key] = realV
          dispatch(d, realV)
          if (e.last) onAfter?.()
        })
      return
    }

    // ---- normal slider ----
    const range = d.tier === 'T1' ? (d.range ?? [0, 1]) : d.range
    const step = d.step ?? 0.01
    container
      .addBinding(target, key, {
        label: d.name ?? key,
        min: range[0],
        max: range[1],
        step
      })
      .on('change', (e) => {
        const v = e.value as number
        if (isT3) {
          if (e.last) {
            dispatch(d, v)
            onAfter?.()
          }
        } else {
          dispatch(d, v)
          onAfter?.()
        }
      })
  }

  // function pushAll(descriptors: ControlDescriptor[]): void {
  //   descriptors.forEach((d) => {
  //     const binding = resolveBinding(d)
  //     if (!binding) return
  //     const v = binding.target[binding.key]
  //     if (v === undefined || v === null) return
  //     dispatch(d, v as number | Vec3)
  //   })
  // }

  function pushAll(descriptors: ControlDescriptor[]): void {
    const spectrumLayersToRebuild = new Set<number>()

    descriptors.forEach((d) => {
      const binding = resolveBinding(d)
      if (!binding) return

      const v = binding.target[binding.key]
      if (v === undefined || v === null) return

      if (d.tier === 'T3-spectrum') {
        spectrumLayersToRebuild.add(d.layerIndex)
        return
      }

      dispatch(d, v as number | Vec3)
    })

    for (const layerIndex of spectrumLayersToRebuild) {
      deps.rebuildLayerSpectrum(layerIndex)
    }
  }

  return { addControl, pushAll }
}

export type TieringHook = ReturnType<typeof useTiering>
