/**
 * 二维风向。
 *
 * 工厂允许调用方传入任意非零向量，并在创建 Spectrum 前将其归一化。
 */
export interface PhillipsWindDirection {
  /** 沿海面 X 轴的方向分量。 */
  x: number

  /** 沿海面 Z 轴的方向分量。沿用旧代码字段名 `y` 以减少配置迁移。 */
  y: number
}

/**
 * 创建 PhillipsSpectrum 时允许调用方提供的配置。
 *
 * `windSpeed` 与 `windDirection` 是 Phillips 公式不可缺少的输入，因此必须提供；
 * `amplitude` 和 `opposingWaveDamping` 是工程调参项，可以由工厂采用项目预设。
 *
 * 注意：这里的 `amplitude` 是 Phillips 谱公式中的 A，不是
 * `InitialSpectrumConfig.amplitude`。后者是 InitialSpectrum 生成结果的全局
 * 线性缩放，两者不能混为同一个字段，否则会发生重复放大。
 */
export interface PhillipsSpectrumConfig {
  /** 海面上方 10 m 的风速 U，单位 m/s，必须大于 0。 */
  windSpeed: number

  /** 风传播方向，必须是有限且非零的二维向量。 */
  windDirection: PhillipsWindDirection

  /**
   * Phillips 谱强度系数 A。
   *
   * 项目预设为 `0.008`。该值是经验调参起点，不是适用于所有单位、网格和
   * 离散归一化方式的普适物理常量。
   */
  amplitude?: number

  /**
   * 逆风波能量保留比例，范围 `[0, 1]`。
   *
   * - `0`：完全抑制逆风波；
   * - `1`：顺风和逆风使用相同权重；
   * - 项目预设 `0.3`：保留少量逆风分量，属于视觉选择而非标准常数。
   */
  opposingWaveDamping?: number
}

/**
 * 完成默认值补全、范围检查和风向归一化后的 Phillips 配置。
 *
 * 只有 Spectrum 工厂应该创建该对象；PhillipsSpectrum 只消费它，不再兜底。
 */
export interface ResolvedPhillipsSpectrumConfig {
  /** 已验证为正数的风速，单位 m/s。 */
  windSpeed: number

  /** 已归一化的风向。 */
  windDirection: Readonly<PhillipsWindDirection>

  /** 已验证为非负数的 Phillips 谱强度系数 A。 */
  amplitude: number

  /** 已验证位于 `[0, 1]` 的逆风波保留比例。 */
  opposingWaveDamping: number
}
