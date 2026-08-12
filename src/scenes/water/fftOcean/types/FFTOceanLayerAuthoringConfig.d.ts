import type { Vec2 } from '@/math/types/math'
import type { SpectrumModelConfig } from '@/simulation/ocean/spectrums/types/SpectrumModelConfig'

/**
 * 场景和 GUI 直接编辑的一层 FFT 网格配置。
 *
 * 这里故意与底层只读的 `FFTGridConfig` 显式重复 `size` 和
 * `fftResolution`，并不是漏掉了类型复用：
 *
 * - 本接口表示尚未校验、允许 GUI 原地修改的 authoring 数据；
 * - `FFTGridConfig` 表示 `resolveFFTGridConfig()` 校验、复制后得到的运行时快照；
 * - 若直接复用只读运行时类型，编辑阶段与运行阶段的边界就会被隐藏。
 *
 * 这里选择显式列出两个字段，而不是用 `Mutable<FFTGridConfig>` 一类映射类型，
 * 是为了让教学代码在不跳转类型工具的情况下，也能直接看到编辑器真正提供哪些值。
 */
export interface FFTGridAuthoringConfig {
  /** FFT 平铺区域的物理边长，单位 m；由解析器校验为有限正数。 */
  size: number

  /** FFT 纹理分辨率；由解析器校验为正整数且为 2 的幂。 */
  fftResolution: number
}

/**
 * 场景和 GUI 编辑的一层波谱求值环境。
 *
 * `size` 不在这里重复出现；适配器会以 `grid.size` 作为唯一来源，
 * 再与这些字段组合成只读的 `SpectrumEvaluationContext`。
 */
export interface SpectrumEvaluationAuthoringConfig {
  /** 重力加速度，单位 m/s²。 */
  gravity: number

  /** 水深，单位 m；`undefined` 表示深水极限。 */
  depth?: number

  /** 最小波数；`undefined` 表示不额外做下界截断。 */
  kMin?: number

  /** 最大波数；`undefined` 表示不额外做上界截断。 */
  kMax?: number
}

/** 场景和 GUI 编辑的初始频谱生成参数。 */
export interface InitialSpectrumAuthoringConfig {
  /** 对最终 h₀ 幅度施加的全局线性缩放；不是 Phillips 公式中的 A。 */
  amplitude?: number
}

/** 场景和 GUI 编辑的一层逐帧合成参数。 */
export interface FFTOceanLayerRuntimeAuthoringConfig {
  /** X/Z 方向的 choppy waves 系数。 */
  choppiness: Vec2

  /** 泡沫逐帧衰减率；缺省时由适配器使用当前兼容值 `0.05`。 */
  foamDecayRate?: number

  /** 新泡沫增量；缺省时由适配器使用当前兼容值 `0.1`。 */
  foamAdd?: number

  /** 泡沫阈值偏移；缺省时由适配器使用当前兼容值 `0.2`。 */
  foamBias?: number

  /** 泡沫响应幂次；缺省时由适配器使用当前兼容值 `1.5`。 */
  foamPower?: number
}

/** 场景和 GUI 编辑的一层材质混合参数。 */
export interface FFTOceanLayerBlendAuthoringConfig {
  /** 本层 FFT 输出对最终材质的贡献；缺省时由材质边界使用其默认值。 */
  layerContribute?: number
}

/**
 * 一个 FFT Ocean cascade layer 的可编辑 live state。
 *
 * 本对象属于场景、GUI 和持久化边界，字段允许被编辑。开始初始化或冷重建时，
 * `createFFTOceanLayerBuildInputs()` 会复制、校验并拆成底层模块所需的窄输入，
 * 因而底层计算不需要持有这个可变对象。
 */
export interface FFTOceanLayerAuthoringConfig {
  /** FFT 网格的可编辑原始值。 */
  grid: FFTGridAuthoringConfig

  /** 波谱求值环境的可编辑原始值。 */
  evaluation: SpectrumEvaluationAuthoringConfig

  /**
   * 波谱模型工厂的可编辑输入。
   *
   * 这里有意直接复用 `SpectrumModelConfig`，即使相邻类型都带有
   * `AuthoringConfig` 后缀。原因是 `SpectrumModelConfig` 本身已经表示
   * `createSpectrum()` 接收的“尚未解析的模型配置”，而不是工厂输出的已校验快照；
   * 再建立一套字段完全相同的 `SpectrumModelAuthoringConfig` 只会制造第二份联合类型。
   *
   * `spectrum` 属性本身没有 `readonly`，切换模型时可以把整个联合成员替换为
   * JONSWAP、Phillips 或 Capillary 配置。模型专属的默认值补全与范围校验仍由
   * `createSpectrum()` 负责。
   */
  spectrum: SpectrumModelConfig

  /** 初始频谱生成阶段的可编辑原始值。 */
  initialSpectrum: InitialSpectrumAuthoringConfig

  /** 逐帧合成阶段的可编辑原始值。 */
  runtime: FFTOceanLayerRuntimeAuthoringConfig

  /** 最终材质混合阶段的可编辑原始值。 */
  blend: FFTOceanLayerBlendAuthoringConfig
}
