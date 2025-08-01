import {
  buildGerstnerWaveMaterial,
  GerstnerWaveMaterialParams
} from '@/materials/GerstnerWaveMaterial'
import { buildSineWaveMaterial, SineWaveParams } from '@/materials/SineWaveMaterial'
import { WaterMaterial } from '@/materials/WaterMaterial'
import { WaterSurface } from '@/objects/WaterSurface'
import { TransformationParams } from '@/types/transformation'
import { MeshRender } from '@/renderers/MeshRender'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'

// 水体渲染器类型枚举
export enum WaterRenderType {
  SINE_WAVE = 'sine_wave',
  GERSTNER_WAVE = 'gerstner_wave', // 预留给未来的 Gerstner Wave 实现
  FFT_WAVE = 'fft_wave' // 预留给未来的 FFT 实现
}

// 水体渲染配置接口
export interface WaterRenderManagerConfig {
  // 几何参数
  size: number
  resolution: number
  tranformation: TransformationParams

  // 渲染类型
  renderType: WaterRenderType

  // 材质参数
  materialParams: SineWaveParams | GerstnerWaveMaterialParams | any

  // 渲染选项
  enableReflection?: boolean
  enableRefraction?: boolean
  enableFoam?: boolean
  enableCaustics?: boolean
}

/**
 * 水体渲染管理器（加载器）
 */
export class WaterRenderManager {
  private gl: WebGLRenderingContext
  private config: WaterRenderManagerConfig
  private waterSurface: WaterSurface | null = null
  private waterMaterial: WaterMaterial | null = null
  private meshRender: MeshRender | null = null

  constructor(gl: WebGLRenderingContext, config: WaterRenderManagerConfig) {
    this.gl = gl
    this.config = config
  }

  // 初始化 Water Surface
  private createWaterSurface(): WaterSurface {
    const waterSurface = new WaterSurface(
      this.config.tranformation,
      this.config.size,
      this.config.resolution
    )
    return waterSurface
  }

  // 创建 Water Material
  private async createsMaterial(
    renderType: WaterRenderManagerConfig['renderType']
  ): Promise<WaterMaterial> {
    switch (renderType) {
      case WaterRenderType.SINE_WAVE:
        return await buildSineWaveMaterial(
          this.config.materialParams, // 作用：覆盖默认值
          'src/shaders/waterShader/SinWaveVertex.glsl',
          'src/shaders/waterShader/SinWaveFragment.glsl'
        )
      case WaterRenderType.GERSTNER_WAVE:
        return await buildGerstnerWaveMaterial(
          this.config.materialParams, // 作用：覆盖默认值
          'src/shaders/waterShader/GerstnerWaveVertex.glsl',
          'src/shaders/waterShader/GerstnerWaveFragment.glsl'
        )
      case WaterRenderType.FFT_WAVE:
        // TODO: 实现 FFT 波浪材质
        throw new Error('FFT WAVE material not implemented yet')
      default:
        throw new Error(`Unknown water render type: ${this.config.renderType}`)
    }
  }

  async initMeshRender() {
    try {
      this.waterSurface = this.createWaterSurface()
      this.waterMaterial = await this.createsMaterial(this.config.renderType)
      this.meshRender = new MeshRender(this.gl, this.waterSurface, this.waterMaterial)

      console.log(`Water renderer initialized with type: ${this.config.renderType}`)
    } catch (error) {
      console.error('Failed to initialize water renderer:', error)
      throw error
    }
  }

  // 获取当前的MeshRender对象
  getMeshRender(): MeshRender | null {
    return this.meshRender
  }
}

export async function loadWater(renderer: WebGLRenderer, config: WaterRenderManagerConfig) {
  const waterRenderManager = new WaterRenderManager(renderer.gl, config)
  await waterRenderManager.initMeshRender()

  // 将MeshRender添加到WebGLRenderer中
  renderer.addMeshRender(waterRenderManager.getMeshRender())
}
