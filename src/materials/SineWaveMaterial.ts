import { getShaderString } from '@/loaders/loadShader'
import { WaterMaterial, WaterMaterialParams } from '@/materials/WaterMaterial'
import { Uniforms } from '@/types/Material'

// 正弦波特有的参数接口
export interface SineWaveParams extends WaterMaterialParams {
  // 正弦波控制参数
  amplitude: number
  waveVector: number
  angularFrequency: number
  // speed: number

  // 多层波浪参数
  // layerWeights?: number[] // 各层权重
  // layerSpeeds?: number[] // 各层速度
  // layerDirections?: number[][] // 各层方向向量
  // waveVectorCoefficient?: number[] // 波矢 k 的系数（倍数）
  // angularFrequencyCoefficient?: number[] // 角频率 ω 的系数（倍数）
}

// 正弦波水体材质类
export class SineWaveMaterial extends WaterMaterial {
  private sineWaveParams: SineWaveParams

  constructor(
    sineWaveParams: SineWaveParams,
    vertexShaderContent: string,
    fragmentShaderContent: string
  ) {
    // 设置正弦波默认参数
    const defaultSineWaveParams: SineWaveParams = {
      amplitude: 1.0,
      waveVector: 1.0,
      angularFrequency: 2 * Math.PI,
      // 作用：覆盖默认值
      ...sineWaveParams
    }

    // 构建正弦波特有的uniforms
    const sineWaveUniforms: Uniforms = {
      // 正弦波基础参数
      uAmplitude: { type: '1f', value: defaultSineWaveParams.amplitude }, // A
      uWaveVector: { type: '1f', value: defaultSineWaveParams.waveVector }, // k
      uAngularFreq: { type: '1f', value: defaultSineWaveParams.angularFrequency } // ω
    }

    super(defaultSineWaveParams, vertexShaderContent, fragmentShaderContent, sineWaveUniforms)

    this.sineWaveParams = defaultSineWaveParams
  }

  // // 设置振幅
  // setAmplitude(amplitude: number) {
  //   this.sineWaveParams.amplitude = amplitude
  //   this.uniforms.uAmplitude.value = amplitude
  // }

  // // 设置波矢
  // setWaveVector(waveVector: number) {
  //   this.sineWaveParams.waveVector = waveVector
  //   this.uniforms.uWaveVector.value = waveVector
  // }

  // // 设置角频率
  // setAngularFrequency(omega: number) {
  //   this.sineWaveParams.angularFrequency = omega
  //   this.uniforms.uAngularFrequency.value = omega
  // }

  // // 获取正弦波参数
  // getSineWaveParams() {
  //   return { ...this.sineWaveParams }
  // }
}

export async function buildSineWaveMaterial(
  sineWaveParams: SineWaveParams,
  vertexPath: string,
  fragmentPath: string
): Promise<SineWaveMaterial> {
  const waveParams: SineWaveParams = {
    amplitude: 0.1,
    waveVector: 0.1 * 2 * Math.PI,
    angularFrequency: 2 * Math.PI,
    // 作用：覆盖默认值
    ...sineWaveParams
  }

  let vertexShaderContent = await getShaderString(vertexPath)
  let fragmentShaderContent = await getShaderString(fragmentPath)

  return new SineWaveMaterial(waveParams, vertexShaderContent, fragmentShaderContent)
}
