import { Material } from '@/materials/Material'
import { Uniforms, UniformType } from '@/materials/types/Material'
import { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'
import { FFTOceanMaterialConfig } from './types/FFTOceanMaterialConfig'
import { FFT_OCEAN_MATERIAL_DEFAULTS } from './_config/defaults'

export class FFTOceanMaterial extends Material {
  constructor(label: string, oceanParams: OceanParams, config: FFTOceanMaterialConfig = {}) {
    const p: Required<FFTOceanMaterialConfig> = { ...FFT_OCEAN_MATERIAL_DEFAULTS, ...config }

    console.debug(p)

    const uniforms: Uniforms = {
      // ---- 纹理开关 ----
      uUseDiffuseMap: { type: UniformType.ONE_I, value: p.useDiffuseMap },
      uUseNormalMap: { type: UniformType.ONE_I, value: p.useNormalMap },
      uUseEnvironmentMap: { type: UniformType.ONE_I, value: p.useEnvironmentMap },

      // ---- 基础纹理（按开关条件注入） ----
      ...(p.useDiffuseMap && p.diffuseMap
        ? { uDiffuseMap: { type: UniformType.TEXTURE_2D, value: p.diffuseMap } }
        : {}),
      ...(p.useNormalMap && p.normalMap
        ? { uNormalMap: { type: UniformType.TEXTURE_2D, value: p.normalMap } }
        : {}),
      ...(p.useEnvironmentMap && p.environmentMap
        ? { uEnvironmentMap: { type: UniformType.TEXTURE_CUBE, value: p.environmentMap } }
        : {}),

      // ---- 水体颜色 ----
      uWaterColor: { type: UniformType.THREE_FV, value: p.waterColor },
      uDeepWaterColor: { type: UniformType.THREE_FV, value: p.deepWaterColor },
      uShallowWaterColor: { type: UniformType.THREE_FV, value: p.shallowWaterColor },

      // ---- 水体物理参数 ----
      uTransparency: { type: UniformType.ONE_F, value: p.transparency },
      uReflectance: { type: UniformType.ONE_F, value: p.reflectance },
      uRefractiveIndex: { type: UniformType.ONE_F, value: p.refractiveIndex },

      // ---- 水深模型 ----
      uDepthModel: { type: UniformType.ONE_I, value: p.depthModel },
      uMaxDepth: { type: UniformType.ONE_F, value: p.maxDepth },
      uMinDepth: { type: UniformType.ONE_F, value: p.minDepth },
      uDepthCenter: { type: UniformType.TWO_FV, value: p.depthCenter },
      uDepthFalloff: { type: UniformType.ONE_F, value: p.depthFalloff },

      // ---- 相机位置：占位，由 ForwardRenderPass 每帧推送 ----
      uCameraPos: { type: UniformType.THREE_FV, value: [0, 0, 0] },

      // ---- 光照 ----
      uSpecularPower: { type: UniformType.ONE_F, value: p.specularPower },
      uFresnelPower: { type: UniformType.ONE_F, value: p.fresnelPower },

      // ---- FFT Ocean 几何参数 ----
      uGeometrySize: { type: UniformType.ONE_F, value: oceanParams.size },
      uTextureSize: { type: UniformType.ONE_F, value: oceanParams.fftResolution },
      uMagnificationXZ: { type: UniformType.ONE_F, value: p.magnificationXZ },
      uMagnificationY: { type: UniformType.ONE_F, value: p.magnificationY },

      // ---- FFT Ocean 纹理 ----
      uDisplacementMap: { type: UniformType.TEXTURE_2D, value: p.displacementMap },
      uGradientMap: { type: UniformType.TEXTURE_2D, value: p.gradientMap },
      uDispDerivativeMap: { type: UniformType.TEXTURE_2D, value: p.dispDerivativeMap }
    }

    super(label, uniforms, null)
  }

  // ---- 运行时更新（供 ComputeManager 每帧调用） ----

  /** 更新 FFT 输出纹理 */
  setDisplacementMap(texture: WebGLTexture): void {
    this.uniforms['uDisplacementMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  setGradientMap(texture: WebGLTexture): void {
    this.uniforms['uGradientMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  setDispDerivativeMap(texture: WebGLTexture): void {
    this.uniforms['uDispDerivativeMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  /** 更新时间（用于 shader 中的动画效果，如泡沫闪烁） */
  setTime(time: number): void {
    this.uniforms['uTime'] = { type: UniformType.ONE_F, value: time }
  }
}
