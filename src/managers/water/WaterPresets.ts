import { WaterRenderManagerConfig, WaterRenderType } from '@/managers/water/WaterRenderManager'
import type { SineWaveParams } from '@/materials/SineWaveMaterial'
import { setTransform } from '@/utils/transformation'
import { GerstnerWaveMaterialParams, GerstnerWaveParams } from '@/materials/GerstnerWaveMaterial'

export class WaterPresets {
  /**
   * 平静的湖水 - 使用正弦波
   * @param {number} size 水面大小
   * @param {number} resolution 水面分辨率，不要超过 255，因为 WebGL1.0 中 vertex 的索引范围为 0 ~ 65535（2^16bit）
   * */
  static createCalmLake(size: number = 50, resolution: number = 250): WaterRenderManagerConfig {
    return {
      size,
      resolution,
      tranformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0),
      renderType: WaterRenderType.SINE_WAVE,
      materialParams: {
        // 水体颜色参数
        waterColor: [0.1, 0.3, 0.5],
        deepWaterColor: [0.0, 0.1, 0.2],
        shallowWaterColor: [0.2, 0.6, 0.8],
        // 水体物理参数
        transparency: 0.85,
        reflectance: 0.4,
        refractiveIndex: 1.33,
        // 正弦波控制参数
        amplitude: 0.2,
        waveVector: 0.1 * 2 * Math.PI,
        angularFrequency: 2 * Math.PI
      } as SineWaveParams
    }
  }

  //海洋波浪 - 使用Gerstner波
  static createGerstnerWaves(
    size: number = 50,
    resolution: number = 250
  ): WaterRenderManagerConfig {
    const calm: GerstnerWaveParams[] = [
      {
        direction: [1.0, 0.0],
        steepness: 0.1,
        wavelength: 10.0,
        speedMultiplier: 0.8,
        phase: 0.0
      },
      {
        direction: [0.8, 0.6],
        steepness: 0.08,
        wavelength: 12.0,
        speedMultiplier: 0.9,
        phase: Math.PI * 0.3
      }
    ]
    // 中等海浪
    const moderate: GerstnerWaveParams[] = [
      {
        direction: [1.0, 0.0],
        steepness: 0.3,
        wavelength: 10.0,
        speedMultiplier: 1.0,
        phase: 0.0
      },
      {
        direction: [0.7, 0.7],
        steepness: 0.25,
        wavelength: 8.0,
        speedMultiplier: 1.2,
        phase: Math.PI * 0.5
      },
      {
        direction: [-0.5, 0.8],
        steepness: 0.2,
        wavelength: 6.0,
        speedMultiplier: 1.5,
        phase: Math.PI
      }
    ]
    // 汹涌海面
    const rough: GerstnerWaveParams[] = [
      {
        direction: [1.0, 0.0],
        steepness: 0.5,
        wavelength: 12.0,
        speedMultiplier: 1.0,
        phase: 0.0
      },
      {
        direction: [0.7, 0.7],
        steepness: 0.4,
        wavelength: 8.0,
        speedMultiplier: 1.3,
        phase: Math.PI * 0.4
      },
      {
        direction: [-0.6, 0.8],
        steepness: 0.35,
        wavelength: 6.0,
        speedMultiplier: 1.8,
        phase: Math.PI * 0.7
      }
    ]

    return {
      size,
      resolution,
      tranformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0),
      renderType: WaterRenderType.GERSTNER_WAVE,
      materialParams: {
        // 水体颜色参数
        waterColor: [0.0, 0.3, 0.5],
        deepWaterColor: [0.0, 0.1, 0.3],
        shallowWaterColor: [0.2, 0.6, 0.8],
        // 水体物理参数
        transparency: 0.7,
        reflectance: 0.5,
        refractiveIndex: 1.33,
        // Gerstner波控制参数
        // waves: [...moderate],
        // waveCount: 3
        waves: [...calm, ...moderate, ...rough],
        waveCount: 8
      } as GerstnerWaveMaterialParams
    }
  }
}
