/**
 * FFT Ocean GUI 控件描述符表
 *
 * 设计理念：
 * - 所有控件以"数据"形式声明，不写过程式的 .add(...).onChange(...)
 * - 每个描述符标记自己的 tier，由 useTiering 自动选 onChange/onFinishChange + 副作用
 * - 新增控件 = 在表里加一行；改 tier 行为 = 改 useTiering，一处生效
 */

/** 控件分级标签（导出供 consumer 使用） */
export type Tier = 'T1' | 'T2-contribute' | 'T2-choppiness' | 'T2-foam' | 'T3-spectrum'

interface BaseDescriptor {
  name?: string
}

export interface T1Descriptor extends BaseDescriptor {
  tier: 'T1'
  key: string
  uname: string
  widget: 'slider' | 'color' | 'log-slider'
  range?: [number, number]
  step?: number
}

export interface T2ContributeDescriptor extends BaseDescriptor {
  tier: 'T2-contribute'
  layerIndex: number
  range: [number, number]
  step?: number
}

export interface T2ChoppinessDescriptor extends BaseDescriptor {
  tier: 'T2-choppiness'
  layerIndex: number
  axis: 0 | 1
  range: [number, number]
  step?: number
}

export interface T2FoamDescriptor extends BaseDescriptor {
  tier: 'T2-foam'
  layerIndex: number
  key: 'foamBias' | 'foamAdd' | 'foamDecayRate' | 'foamPower'
  range: [number, number]
  step?: number
}

export interface T3SpectrumDescriptor extends BaseDescriptor {
  tier: 'T3-spectrum'
  layerIndex: number
  scope?: 'spectrum0' | 'spectrum1'
  key: string
  range: [number, number]
  step?: number
}

export type ControlDescriptor =
  | T1Descriptor
  | T2ContributeDescriptor
  | T2ChoppinessDescriptor
  | T2FoamDescriptor
  | T3SpectrumDescriptor

// 编译期校验：所有 descriptor 的 tier 必须可赋值给 Tier
// 同时让 Tier 类型"被使用"，消除 noUnusedLocals 警告
type _AssertTierCoverage = ControlDescriptor['tier'] extends Tier ? true : never

const _tierCoverageOk: _AssertTierCoverage = true

export const HOT_TUNING_DESCRIPTORS: ControlDescriptor[] = [
  {
    tier: 'T1',
    key: 'roughness',
    uname: 'uRoughness',
    widget: 'slider',
    range: [0.01, 1],
    step: 0.005,
    name: 'roughness ⭐'
  },
  {
    tier: 'T1',
    key: 'envirLightStrength',
    uname: 'uEnvirLightStrength',
    widget: 'slider',
    range: [0, 3],
    step: 0.05,
    name: 'envir light strength ⭐'
  },
  {
    tier: 'T1',
    key: 'foamUVScale',
    uname: 'uFoamUVScale',
    widget: 'slider',
    range: [0.1, 5],
    step: 0.05,
    name: 'foam UV scale ⭐'
  }
]

export const SSS_DESCRIPTORS: ControlDescriptor[] = [
  { tier: 'T1', key: 'scatterColor', uname: 'uScatterColor', widget: 'color' },
  { tier: 'T1', key: 'scatterPeakColor', uname: 'uScatterPeakColor', widget: 'color' },
  { tier: 'T1', key: 'ambientColor', uname: 'uAmbientColor', widget: 'color' },
  {
    tier: 'T1',
    key: 'scatterStrength',
    uname: 'uScatterStrength',
    widget: 'slider',
    range: [0, 1],
    step: 0.005
  },
  {
    tier: 'T1',
    key: 'wavePeakScatterStrength',
    uname: 'uWavePeakScatterStrength',
    widget: 'slider',
    range: [0, 5],
    step: 0.01
  },
  {
    tier: 'T1',
    key: 'scatterShadowStrength',
    uname: 'uScatterShadowStrength',
    widget: 'slider',
    range: [0, 1],
    step: 0.005
  },
  {
    tier: 'T1',
    key: 'ambientDensity',
    uname: 'uAmbientDensity',
    widget: 'slider',
    range: [0, 0.3],
    step: 0.001
  }
]

export const PBR_DESCRIPTORS: ControlDescriptor[] = [
  {
    tier: 'T1',
    key: 'foamRoughness',
    uname: 'uFoamRoughness',
    widget: 'slider',
    range: [0, 1],
    step: 0.005
  },
  {
    tier: 'T1',
    key: 'refractiveIndex',
    uname: 'uRefractiveIndex',
    widget: 'slider',
    range: [1.0, 1.5],
    step: 0.01
  }
]

export const FOAM_MAT_DESCRIPTORS: ControlDescriptor[] = [
  { tier: 'T1', key: 'foamColor', uname: 'uFoamColor', widget: 'color' }
]

export const FOG_DESCRIPTORS: ControlDescriptor[] = [
  { tier: 'T1', key: 'fogColor', uname: 'uFogColor', widget: 'color' },
  {
    tier: 'T1',
    key: 'fogDensity',
    uname: 'uFogDensity',
    widget: 'log-slider',
    range: [-5, -1],
    step: 0.01,
    name: 'log10(density)'
  },
  { tier: 'T1', key: 'fogPower', uname: 'uFogPower', widget: 'slider', range: [0.5, 3], step: 0.01 }
]

export const NORMAL_MASK_DESCRIPTORS: ControlDescriptor[] = [
  {
    tier: 'T1',
    key: 'normalStrength',
    uname: 'uNormalStrength',
    widget: 'slider',
    range: [0, 3],
    step: 0.01
  },
  {
    tier: 'T1',
    key: 'heightStrength',
    uname: 'uHeightStrength',
    widget: 'slider',
    range: [0, 3],
    step: 0.01
  },
  {
    tier: 'T1',
    key: 'varMaskRange',
    uname: 'uVarMaskRange',
    widget: 'slider',
    range: [0.1, 5],
    step: 0.01
  },
  {
    tier: 'T1',
    key: 'varMaskPower',
    uname: 'uVarMaskPower',
    widget: 'slider',
    range: [0.5, 5],
    step: 0.01
  },
  {
    tier: 'T1',
    key: 'varMaskTexScale',
    uname: 'uVarMaskTexScale',
    widget: 'slider',
    range: [0.5, 5],
    step: 0.01
  },
  {
    tier: 'T1',
    key: 'displaceDepthAttenuation',
    uname: 'uDisplaceDepthAttenuation',
    widget: 'slider',
    range: [0.1, 5],
    step: 0.01
  },
  {
    tier: 'T1',
    key: 'shadowIntensity',
    uname: 'uShadowIntensity',
    widget: 'slider',
    range: [0, 1],
    step: 0.01
  }
]

export function buildLayerDescriptors(layerIndex: number): ControlDescriptor[] {
  return [
    { tier: 'T2-contribute', layerIndex, range: [0, 1.5], step: 0.01, name: 'layer contribute' },
    { tier: 'T2-choppiness', layerIndex, axis: 0, range: [0, 5], step: 0.05, name: 'choppiness X' },
    { tier: 'T2-choppiness', layerIndex, axis: 1, range: [0, 5], step: 0.05, name: 'choppiness Z' },
    { tier: 'T2-foam', layerIndex, key: 'foamBias', range: [0, 0.5], step: 0.005 },
    { tier: 'T2-foam', layerIndex, key: 'foamAdd', range: [0, 0.5], step: 0.005 },
    { tier: 'T2-foam', layerIndex, key: 'foamDecayRate', range: [0.001, 0.2], step: 0.001 },
    { tier: 'T2-foam', layerIndex, key: 'foamPower', range: [0.5, 3], step: 0.01 },
    { tier: 'T3-spectrum', layerIndex, key: 'amplitude', range: [0, 3], step: 0.01 },
    { tier: 'T3-spectrum', layerIndex, key: 'kMin', range: [0, 50], step: 0.01 },
    { tier: 'T3-spectrum', layerIndex, key: 'kMax', range: [0, 50], step: 0.01 },
    ...buildSpectrumDescriptors(layerIndex, 'spectrum0'),
    ...buildSpectrumDescriptors(layerIndex, 'spectrum1')
  ]
}

function buildSpectrumDescriptors(
  layerIndex: number,
  scope: 'spectrum0' | 'spectrum1'
): T3SpectrumDescriptor[] {
  return [
    {
      tier: 'T3-spectrum',
      layerIndex,
      scope,
      key: 'scale',
      range: [0, 1.5],
      step: 0.01,
      name: `${scope}.scale`
    },
    {
      tier: 'T3-spectrum',
      layerIndex,
      scope,
      key: 'windSpeed',
      range: [1, 30],
      step: 0.1,
      name: `${scope}.windSpeed`
    },
    {
      tier: 'T3-spectrum',
      layerIndex,
      scope,
      key: 'windDirection',
      range: [0, 360],
      step: 1,
      name: `${scope}.windDir`
    },
    {
      tier: 'T3-spectrum',
      layerIndex,
      scope,
      key: 'fetch',
      range: [100, 200000],
      step: 100,
      name: `${scope}.fetch`
    },
    {
      tier: 'T3-spectrum',
      layerIndex,
      scope,
      key: 'spreadBlend',
      range: [0, 1],
      step: 0.01,
      name: `${scope}.spreadBlend`
    },
    {
      tier: 'T3-spectrum',
      layerIndex,
      scope,
      key: 'swell',
      range: [0, 1],
      step: 0.01,
      name: `${scope}.swell`
    },
    {
      tier: 'T3-spectrum',
      layerIndex,
      scope,
      key: 'peakEnhancement',
      range: [1, 7],
      step: 0.1,
      name: `${scope}.peakEnh`
    },
    {
      tier: 'T3-spectrum',
      layerIndex,
      scope,
      key: 'shortWavesFade',
      range: [0.001, 5],
      step: 0.001,
      name: `${scope}.shortFade`
    }
  ]
}
