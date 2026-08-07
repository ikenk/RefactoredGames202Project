import { hw1CaveLight } from '@/lights/directionalLight/_presets/hw1Lights'
import { hw3GbufferPassLight } from '@/lights/directionalLight/_presets/hw3Lights'
import { ModelPaths } from '@/models/_config/modelPaths'

import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { CaveSceneConfig } from '../../types/CaveSceneConfig'

/** Cave 场景配置 -- HW1 Shadow Map */
export const CAVE_SCENE_CONFIG_DIRECTIONAL_LIGHT: CaveSceneConfig = {
  cameraConfig: {
    position: [0, 30, 50],
    target: [0, 10, 0]
  },
  modelConfigs: [
    {
      path: ModelPaths.HW3_CAVE,
      name: 'cave',
      format: 'gltf',
      vertShaderPath: ShaderPaths.DIRECT_LIGHT_VERTEX,
      fragShaderPath: ShaderPaths.DIRECT_LIGHT_FRAGMENT
      // 模型有自己的 transform
      // transform: new Transform([0, 0, 0], [0, 0, 0], [1, 1, 1]),
      // extraUniforms: {
      //   // 固定的场景参数
      //   // 由于现阶段的 BaseRenderer 类型的 updateMaterialUniforms 方法仅支持修改现有的 uniform，因此需要在此处进行 uniform 占位
      //   uLightPos: { type: UniformType.THREE_FV, value: [0, 0, 0] }, // 占位，会被覆盖
      //   uLightDir: { type: UniformType.THREE_FV, value: [0, 0, 0] }, // 占位，会被覆盖
      //   uLightRadiance: { type: UniformType.THREE_FV, value: [0, 0, 0] }, // 占位，会被覆盖
      //   uSpecularColor: { type: UniformType.THREE_FV, value: [1, 1, 1] }, // 占位，会被覆盖
      //   // shadow
      //   uUseDepthTexture: { type: UniformType.ONE_I, value: 0 }, // 占位，会被覆盖
      //   uShadowMap: { type: UniformType.TEXTURE_2D, value: null }, // 占位，会被覆盖
      //   uLightVP: { type: UniformType.MATRIX_4FV, value: mat4.create() } // 占位，会被覆盖
      // }
    }
  ],
  lightConfigs: [
    {
      id: 'HW1 Cave Light',
      light: hw1CaveLight,
      guiConfig: {
        name: 'HW1 Cave Light',
        positionRange: { x: [-100, 100], y: [0, 100], z: [-100, 100] }
      }
    }
  ]
  // 没有天空盒
}

/** Cave 场景配置 -- HW3 GBuffer & SSR */
export const CAVE_SCENE_CONFIG_GBUFFER: CaveSceneConfig = {
  cameraConfig: {
    position: [30, 10, 30],
    target: [0, 10, 0]
  },
  modelConfigs: [
    {
      path: ModelPaths.HW3_CAVE,
      name: 'cave',
      format: 'gltf',
      vertShaderPath: ShaderPaths.GBUFFER_VERTEX,
      fragShaderPath: ShaderPaths.GBUFFER_FRAGMENT
    }
  ],
  lightConfigs: [
    {
      id: 'HW3 Cave Light',
      light: hw3GbufferPassLight,
      guiConfig: {
        name: 'HW3 Cave Light',
        positionRange: { x: [-100, 100], y: [0, 100], z: [-100, 100] }
      }
    }
  ]
  // 没有天空盒
}
