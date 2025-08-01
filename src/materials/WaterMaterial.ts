import { Material } from '@/materials/Material'
import { Texture } from '@/textures/Texture'

import type { Uniforms } from '@/types/Material'

// FIXME: 将该interface移至.d.ts文件中
// 水体材质的基础参数
export interface WaterMaterialParams {
  // 基础纹理
  diffuseMap?: Texture
  normalMap?: Texture
  environmentMap?: Texture

  // 水体颜色参数
  waterColor: [number, number, number] // 主要水体颜色
  deepWaterColor: [number, number, number] // 深水区颜色（模拟深度效果）
  shallowWaterColor: [number, number, number] // 浅水区颜色（近岸效果）

  // 水体物理参数
  transparency: number // 透明度（0-1），控制水的清澈程度
  reflectance: number // 反射强度（0-1），控制镜面反射程度
  refractiveIndex: number // 折射率（通常1.33），用于菲涅尔计算

  // 波浪控制参数 (会被具体的波浪材质类重写)
  // amplitude、frequency、angularFrequency、speed 留给子类扩展
  time: number

  // 光照参数
  specularPower: number
  fresnelPower: number // 菲涅尔强度，控制视角相关的反射变化
}

export abstract class WaterMaterial extends Material {
  protected params: WaterMaterialParams

  constructor(
    params: WaterMaterialParams,
    vertexShaderContent: string,
    fragmentShaderContent: string,
    additionalUniforms: Uniforms = {},
    additionalAttribs: string[] = []
  ) {
    // 设置默认参数
    const defaultParams: WaterMaterialParams = {
      // 水体颜色参数
      waterColor: [0.1, 0.3, 0.5],
      deepWaterColor: [0.0, 0.1, 0.2],
      shallowWaterColor: [0.2, 0.6, 0.8],
      // 水体物理参数
      transparency: 0.8,
      reflectance: 0.3,
      refractiveIndex: 1.33,
      // 波浪控制参数
      time: 0.0,
      // 光照参数
      specularPower: 32.0,
      fresnelPower: 5.0,
      // 作用：覆盖默认值
      ...params
    }

    // 构建基础 uniforms
    const baseUniforms: Uniforms = {
      // 基础纹理
      ...(defaultParams.diffuseMap && {
        uDiffuseMap: { type: 'texture', value: defaultParams.diffuseMap }
      }),
      ...(defaultParams.normalMap && {
        uNormalMap: { type: 'texture', value: defaultParams.normalMap }
      }),
      ...(defaultParams.environmentMap && {
        uEnvironmentMap: { type: 'texture', value: defaultParams.environmentMap }
      }),

      // 水体颜色参数
      uWaterColor: { type: '3fv', value: defaultParams.waterColor },
      uDeepWaterColor: { type: '3fv', value: defaultParams.deepWaterColor },
      uShallowWaterColor: { type: '3fv', value: defaultParams.shallowWaterColor },

      // 水体物理参数
      uTransparency: { type: '1f', value: defaultParams.transparency },
      uReflectance: { type: '1f', value: defaultParams.reflectance },
      uRefractiveIndex: { type: '1f', value: defaultParams.refractiveIndex },

      // 波浪控制参数
      uTime: { type: '1f', value: defaultParams.time },

      // 光照参数
      uSpecularPower: { type: '1f', value: defaultParams.specularPower },
      uFresnelPower: { type: '1f', value: defaultParams.fresnelPower },

      // 纹理使用标志
      uUseDiffuseMap: { type: '1i', value: defaultParams.diffuseMap ? 1 : 0 },
      uUseNormalMap: { type: '1i', value: defaultParams.normalMap ? 1 : 0 },
      uUseEnvironmentMap: { type: '1i', value: defaultParams.environmentMap ? 1 : 0 },

      // 合并额外的uniforms
      ...additionalUniforms
    }

    // 构建基础 attributes
    const baseAttributes = [...additionalAttribs]

    super(baseUniforms, baseAttributes, vertexShaderContent, fragmentShaderContent, null)
    this.params = defaultParams
  }

  // 更新时间
  // updateTime(time: number): void {
  //   this.params.time = time
  //   this.uniforms.uTime.value = time
  // }

  // 更新水体颜色
  // updateWaterColor(color: Vec3): void {
  //   this.params.waterColor = color
  //   this.uniforms.uWaterColor.value = color
  // }

  // 更新材质参数
  // updateMaterialParams(params: Partial<WaterMaterial>) {}

  // 获取当前参数
  // getParams(): WaterMaterialParams {
  //   return { ...this.params }
  // }
}
