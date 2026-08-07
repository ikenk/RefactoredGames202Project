import { FFTOceanMaterialConfig } from '@/materials/water/types/FFTOceanMaterialConfig'
import { Transform } from '@/objects/utils/Transform'
import { FFT_OCEAN_MATERIAL_DEFAULTS } from '@/materials/water/_config/defaults'
import { FFTOceanConfig } from '../types/FFTOceanConfig'

export const FFT_OCEAN_MATERIAL_OVERRIDES: FFTOceanMaterialConfig = {
  useEnvironmentMap: 1,
  // environmentMap: null,  ← 运行时由 loadScene 注入
  // shallowWaterColor: [0.4, 0.9, 0.9],
  // waterColor: [0.2, 0.6, 0.8],
  // deepWaterColor: [0.3, 0.3, 0.3],

  // deepWaterColor: [0.01, 0.05, 0.15], // 深海深蓝
  // waterColor: [0.05, 0.25, 0.45], // 中等蓝
  // shallowWaterColor: [0.15, 0.5, 0.7], // 浅海青蓝（不要太绿）
  reflectance: 0.8,
  maxDepth: 1000.0,
  minDepth: 1000.0
  // magnificationXZ: 1.0,
  // magnificationY: 1.0
}

/**
 * FFT Ocean 场景配置
 *
 * 纯数据，不包含 GPU 操作。
 * 纹理（environmentMap、displacementMap 等）由场景加载时注入。
 */
// export const FFT_OCEAN_SCENE_CONFIG: FFTOceanRenderManagerConfig = {
//   transform: Transform.identity(),
//   materialParams: {
//     // 纹理使用标志
//     useDiffuseMap: 0,
//     useNormalMap: 0,
//     useEnvironmentMap: 1,
//     // 纹理（由场景加载时注入，配置中不创建 GPU 资源）
//     diffuseMap: null,
//     normalMap: null,
//     environmentMap: null, // ← 场景加载时从 createSkyboxRenderer 获取
//     // 水体颜色参数
//     shallowWaterColor: [0.4, 0.9, 0.9],
//     waterColor: [0.2, 0.6, 0.8],
//     deepWaterColor: [0.0, 0.3, 0.6],
//     // 水体物理参数
//     transparency: 0.85,
//     reflectance: 0.8,
//     refractiveIndex: 1.33,
//     // 波浪控制参数
//     time: 0.0,
//     // 水深模型参数
//     depthModel: 2,
//     maxDepth: 1000.0,
//     minDepth: 1000.0,
//     depthCenter: [0, 0],
//     depthFalloff: 1.5,
//     // 光照参数
//     lightColor: [0.5, 0.5, 0.5],
//     lightPos: [2, 2, 2],
//     lightDir: [0.3, -0.7, 0.2],
//     specularPower: 2.0,
//     fresnelPower: 5.0,

//     displacementMap: null,
//     gradientMap: null,
//     dispDerivativeMap: null
//   },
//   cascadeConfig: {
//     renderingMode: RenderingMode.LINE,
//     // FIXME: 暂时未完成多波叠加
//     enabled: false, // 是否启用 cascade，true 为 cascade，false 为 single
//     meshResolution: 128, // 目标统一分辨率，默认使用最高层分辨率
//     meshSize: 256, // 目标统一范围，默认使用最大范围
//     blendMode: BlendMode.WEIGHTED, // 混合模式：相加或加权
//     layerParamsSet: [
//       // 效果一
//       {
//         size: 256, // 256m 海面
//         resolution: 128, // 128 分辨率
//         amplitude: 30, // 振幅放大系数
//         choppiness: 2.3, // 稍强的 choppy 效果
//         windSpeed: 13, // 风速
//         windDirection: { x: 1, y: 1 }, // 风向
//         gravity: 9.81,
//         fetch: 100000, // 100km fetch (单位: 米)
//         depth: 1000 // 水深 (单位: 米)
//       },
//       // 效果二
//       {
//         size: 256, // 256m 海面
//         resolution: 128, // 128 分辨率
//         amplitude: 30, // 振幅放大系数
//         choppiness: 3.3, // 稍强的 choppy 效果
//         windSpeed: 13, // 风速
//         windDirection: { x: 1, y: 1 }, // 风向
//         gravity: 9.81,
//         fetch: 100000, // 100km fetch (单位: 米)
//         depth: 1000 // 水深 (单位: 米)
//       },
//       // 效果三
//       {
//         size: 256, // 256m 海面
//         resolution: 128, // 128 分辨率
//         amplitude: 30, // 振幅放大系数
//         choppiness: 5.3, // 很强的 choppy 效果
//         windSpeed: 13, // 风速
//         windDirection: { x: 1, y: 1 }, // 风向
//         gravity: 9.81,
//         fetch: 100000, // 100km fetch (单位: 米)
//         depth: 1000 // 水深 (单位: 米)
//       },
//       {
//         size: 32, // 32m 海面
//         resolution: 128, // 128 分辨率
//         amplitude: 10, // 振幅放大系数
//         choppiness: 3.0, // 稍强的 choppy 效果
//         windSpeed: 22, // 风速
//         windDirection: { x: 1, y: -1 },
//         gravity: 9.81,
//         fetch: 100000, // 100km fetch (单位: 米)
//         depth: 1000 // 水深
//       }
//     ]
//   }
// }

export const DEFAULT_FFT_OCEAN_CONFIG: FFTOceanConfig = {
  // ==================== Mesh ====================
  transform: new Transform([0, 0, 0], [0, 0, 0], [1, 1, 1]),
  // surfaceSize: 256,
  // surfaceMeshResolution: 128,
  surfaceSize: 2048,
  surfaceMeshResolution: 128,

  // ==================== Material ====================
  materialConfig: {
    ...FFT_OCEAN_MATERIAL_DEFAULTS,
    ...FFT_OCEAN_MATERIAL_OVERRIDES
  },

  // ==================== Renderer ====================
  renderingMode: 'MESH',

  // ==================== FFT Calculate ====================
  oceanParams: {
    // size(L) 和 fftResolution(N) 决定了采样频率 N / L 和采样精度 Δk = 2π / L
    size: 256, // uGeometrySize -- 海面尺寸 L
    fftResolution: 256, // uTextureSize -- 采样数量 N
    amplitude: 1,
    choppiness: [1.8, 1.8],
    windSpeed: 7,
    windDirection: { x: 1, y: 1 },
    gravity: 9.81,
    fetch: 100000,
    depth: 1000
  }
}
