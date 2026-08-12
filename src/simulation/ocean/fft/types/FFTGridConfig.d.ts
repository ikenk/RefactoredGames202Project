/**
 * 经过 `resolveFFTGridConfig()` 校验和复制的 FFT 离散网格快照。
 *
 * 这里故意与 `FFTGridAuthoringConfig` 显式重复 `size` 和
 * `fftResolution`，因为二者处于不同边界：authoring 类型是 GUI 可以修改的
 * 原始输入，本接口则是底层 FFT 计算只读消费的运行时结果。相同字段不代表
 * 相同语义，也不能用一次类型断言代替解析器的运行时校验。
 *
 * `readonly` 只阻止 TypeScript 调用方重新赋值，并不能证明数值有效；正式运行时
 * 应只把解析器返回的对象当作 `FFTGridConfig` 使用。
 */
export interface FFTGridConfig {
  /** 已校验为有限正数的海面物理边长 L，单位 m。 */
  readonly size: number

  /** 已校验为正整数且为 2 的幂的 FFT 纹理分辨率。 */
  readonly fftResolution: number
}
