/**
 * useTiering — 按 descriptor.tier 装配 dat.GUI 控件并分发副作用
 *
 * 设计：
 * - dispatcher 表按 tier 分发到具体的 typed handler，每个 handler 类型安全
 * - 主入口 addControl 根据 descriptor.widget 选 dat.GUI 控件类型（slider/color/log-slider）
 * - 根据 tier 选 onChange (T1/T2) 或 onFinishChange (T3)
 */

import { GUI, GUIController } from 'dat.gui'
import { UniformEntry, UniformType } from '@/materials/types/Material'
import type { Vec2, Vec3 } from '@/math/types/math'
import type { FFTOceanGUIDeps } from '@/gui/fftOcean/types/setup-v2'
import type {
  ControlDescriptor,
  T1Descriptor,
  T2ContributeDescriptor,
  T2ChoppinessDescriptor,
  T2FoamDescriptor,
  T3SpectrumDescriptor
} from '../descriptors'

/** dat.GUI 的 addColor 偶尔返回 hex 字符串；统一成 [r, g, b] ∈ [0, 1] */
function hexToVec3(hex: string): Vec3 {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m?.[1] || !m[2] || !m[3]) return [0, 0, 0]
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

/**
 * 按 widget 类型构造 UniformEntry。
 *
 * ⚠️ 为什么不用 `Record<widget, UniformType>` 映射表？
 *   因为通过映射表的索引访问 `MAP[d.widget]` 会把 UniformType 字面量宽化成
 *   联合枚举 `UniformType`，而 `UniformEntry` 是 discriminated union，
 *   每个 arm 要求 type 字段是具体字面量（如 UniformType.ONE_F）。
 *   宽化后 TS 无法对应到具体 arm → 报 "不能赋给 TEXTURE_CUBE" 等。
 *
 *   用 switch 直接构造，每条分支里 `type` 都是字面量，TS 能正确收窄。
 */
function makeT1UniformEntry(widget: T1Descriptor['widget'], v: number | Vec3): UniformEntry {
  switch (widget) {
    case 'slider':
    case 'log-slider':
      return { type: UniformType.ONE_F, value: v as number }
    case 'color':
      return { type: UniformType.THREE_FV, value: v as Vec3 }
  }
}

export function useTiering(deps: FFTOceanGUIDeps) {
  const mat = deps.config.materialConfig as Record<string, unknown>
  const cascade = deps.config.oceanParamsCascade

  // ============================================================
  // tier 分发：每个 handler 类型严格
  // ============================================================

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

  function dispatchT2Foam(d: T2FoamDescriptor, v: number): void {
    // 临时方案：直接 mutate compute pass 私有 layerStates（cast hack）
    // TODO: compute pass 暴露 setLayerFoam 后改正式调用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const states = (deps.computePass as any).layerStates as
      | Array<Record<string, number>>
      | undefined
    const target = states?.[d.layerIndex]
    if (target) target[d.key] = v
  }

  function dispatchT3Spectrum(d: T3SpectrumDescriptor): void {
    const layer = cascade[d.layerIndex]
    if (!layer) return
    deps.computePass.rebuildLayerSpectrum(d.layerIndex, layer, deps.spectrum)
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

  // ============================================================
  // 把 descriptor 解析为 (target, key)，让 dat.GUI 直接绑定原始 config
  // ============================================================
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

  // ============================================================
  // 创建控件并按 tier 接线
  // ============================================================
  function addControl(
    folder: GUI,
    d: ControlDescriptor,
    onAfter?: () => void
  ): GUIController | null {
    const binding = resolveBinding(d)
    if (!binding) {
      console.warn('[useTiering] resolveBinding returned null:', d)
      return null
    }
    const { target, key } = binding
    const eventMethod: 'onChange' | 'onFinishChange' =
      d.tier === 'T3-spectrum' ? 'onFinishChange' : 'onChange'

    // ---- color widget ----
    if (d.tier === 'T1' && d.widget === 'color') {
      const ctrl = folder.addColor(target, key).name(d.name ?? key)
      ctrl.onChange((v: unknown) => {
        const arr = Array.isArray(v) ? (v as Vec3) : hexToVec3(v as string)
        target[key] = arr
        dispatch(d, arr)
        onAfter?.()
      })
      return ctrl
    }

    // ---- log-slider widget ----
    if (d.tier === 'T1' && d.widget === 'log-slider') {
      const initial = (target[key] as number | undefined) ?? 1e-10
      const proxy = { logValue: Math.log10(Math.max(initial, 1e-10)) }
      const range = d.range ?? [-5, -1]
      const step = d.step ?? 0.01
      const ctrl = folder
        .add(proxy, 'logValue', range[0], range[1], step)
        .name(d.name ?? `${key} (log10)`)
      ctrl[eventMethod]((logV: number) => {
        const realV = Math.pow(10, logV)
        target[key] = realV
        dispatch(d, realV)
        onAfter?.()
      })
      return ctrl
    }

    // ---- normal slider ----
    const range = getDescriptorRange(d)
    const step = getDescriptorStep(d)
    const ctrl = folder.add(target, key, range[0], range[1], step).name(d.name ?? key)
    ctrl[eventMethod]((v: number) => {
      dispatch(d, v)
      onAfter?.()
    })
    return ctrl
  }

  /** restore/reset 后用：把所有描述符的当前值推回 GPU */
  function pushAll(descriptors: ControlDescriptor[]): void {
    descriptors.forEach((d) => {
      const binding = resolveBinding(d)
      if (!binding) return
      const v = binding.target[binding.key]
      if (v === undefined || v === null) return
      // T1 color 值是 [r,g,b]；其他都是 number；T2-choppiness 的 v 不重要
      dispatch(d, v as number | Vec3)
    })
  }

  return { addControl, pushAll }
}

// ============================================================
// helpers
// ============================================================

function getDescriptorRange(d: ControlDescriptor): [number, number] {
  if (d.tier === 'T1') return d.range ?? [0, 1]
  return d.range
}

function getDescriptorStep(d: ControlDescriptor): number {
  if (d.tier === 'T1') return d.step ?? 0.01
  return d.step ?? 0.01
}

export type TieringHook = ReturnType<typeof useTiering>
