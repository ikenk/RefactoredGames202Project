import { getShaderString } from '@/loaders/loadShader'
import { WaterMaterial, WaterMaterialParams } from '@/materials/WaterMaterial'
import { Uniforms } from '@/types/Material'
import { Vec2 } from '@/types/math'

export interface GerstnerWaveParams {
  direction: Vec2 // 波浪传播方向
  steepness: number // 陡峭度
  wavelength: number // 波长
  speedMultiplier: number // 速度倍数
  phase?: number // 相位偏移
}

export interface GerstnerWaveMaterialParams extends WaterMaterialParams {
  waves: GerstnerWaveParams[] // 波浪数组，最多8个
  waveCount?: number // 实际使用的波浪数量，如果不指定则使用waves.length
}

export class GerstnerWaveMaterial extends WaterMaterial {
  constructor(
    gerstnerWaveMaterialParams: GerstnerWaveMaterialParams,
    vertexShaderContent: string,
    fragmentShaderContent: string
  ) {
    if (
      gerstnerWaveMaterialParams.waves &&
      gerstnerWaveMaterialParams.waves.length &&
      gerstnerWaveMaterialParams.waves.length > 8
    ) {
      gerstnerWaveMaterialParams.waves = gerstnerWaveMaterialParams.waves.slice(0, 8)
      gerstnerWaveMaterialParams.waveCount = 8
    }

    // 设置默认参数
    const defaultGerstnereMaterialWaveParams: GerstnerWaveMaterialParams = {
      waves: [
        {
          direction: [1.0, 0.0],
          steepness: 0.3,
          wavelength: 10.0,
          speedMultiplier: 1.0,
          phase: 0.0
        }
      ],
      waveCount: 1,
      ...gerstnerWaveMaterialParams
    }

    const gerstnerWaveUniforms: Uniforms = {
      // 波浪参数数组 - 需要分别设置每个波的各个属性
      // 波浪数量
      uWaveCount: { type: '1i', value: defaultGerstnereMaterialWaveParams.waveCount }
    }

    for (let i = 0; i < defaultGerstnereMaterialWaveParams.waveCount; i++) {
      const wave = defaultGerstnereMaterialWaveParams.waves[i]

      gerstnerWaveUniforms[`uWaves[${i}].direction`] = {
        type: '2fv',
        value: new Float32Array(wave.direction)
        // value: wave.direction
      }
      gerstnerWaveUniforms[`uWaves[${i}].steepness`] = {
        type: '1f',
        value: wave.steepness
      }
      gerstnerWaveUniforms[`uWaves[${i}].wavelength`] = {
        type: '1f',
        value: wave.wavelength
      }
      gerstnerWaveUniforms[`uWaves[${i}].speedMultiplier`] = {
        type: '1f',
        value: wave.speedMultiplier
      }
      gerstnerWaveUniforms[`uWaves[${i}].phase`] = {
        type: '1f',
        value: wave.phase
      }
    }

    // console.log(gerstnerWaveUniforms)

    super(
      defaultGerstnereMaterialWaveParams,
      vertexShaderContent,
      fragmentShaderContent,
      gerstnerWaveUniforms
    )
  }
}

export async function buildGerstnerWaveMaterial(
  gerstnerWaveMaterialParams: GerstnerWaveMaterialParams,
  vertexPath: string,
  fragmentPath: string
): Promise<GerstnerWaveMaterial> {
  let vertexShaderContent = await getShaderString(vertexPath)
  let fragmentShaderContent = await getShaderString(fragmentPath)

  // 设置默认波浪参数
  const defaultGerstnerWaveParams: GerstnerWaveParams[] = [
    {
      direction: [1.0, 0.0],
      steepness: 0.3,
      wavelength: 10.0,
      speedMultiplier: 1.0,
      phase: 0.0
    },
    {
      direction: [0.7, 0.7],
      steepness: 0.2,
      wavelength: 8.0,
      speedMultiplier: 1.2,
      phase: Math.PI * 0.5
    }
  ]

  const params: GerstnerWaveMaterialParams = {
    waves: defaultGerstnerWaveParams,
    waveCount: 2,
    // 覆盖默认值
    ...gerstnerWaveMaterialParams
  }

  return new GerstnerWaveMaterial(params, vertexShaderContent, fragmentShaderContent)
}
