import urlJoin from 'url-join'

/**
 * 资源路径配置
 *
 * 使用环境变量支持多环境部署：
 * - 开发环境：直接访问源文件
 * - 生产环境：访问构建后文件
 */

// ========== 基础路径 ==========

/**
 * 所有静态资源都部署在当前应用的同一站点下。
 *
 * BASE_URL 由 Vite 的 base 生成，例如生产环境为 /aimimi-engine/。
 * VITE_*_BASE 是不以 / 开头、但以 / 结尾的相对目录片段。
 */
export const BASE_URL = import.meta.env.BASE_URL

export const BASES = {
  shaders: urlJoin(BASE_URL, import.meta.env.VITE_SHADER_BASE),
  textures: urlJoin(BASE_URL, import.meta.env.VITE_TEXTURE_BASE),
  models: urlJoin(BASE_URL, import.meta.env.VITE_MODEL_BASE),
  prtSHTxt: urlJoin(BASE_URL, import.meta.env.VITE_PRT_SH_BASE)
} as const

/**
 * 模型基础路径
 */
// export const MODEL_BASE = urlJoin(BASE_URL, import.meta.env.VITE_MODEL_BASE || '/assets/models')

/**
 * 配置文件基础路径
 */
// export const CONFIG_BASE = urlJoin(BASE_URL, import.meta.env.VITE_CONFIG_BASE || '/configs')

// ========== 纹理路径 Deprecated ==========

/**
 * 纹理基础路径
 */
// export const TEXTURE_BASE = urlJoin(
//   BASE_URL,
//   import.meta.env.VITE_TEXTURE_BASE || '/assets/textures'
// )

// FIXME: 未来使用的代码
// export const TexturePaths = {
//   // 天空盒
//   Skyboxes: {
//     SKY_09: urlJoin(TEXTURE_BASE, '/skyboxes/sky_09_cubemap/'),
//     SKY_18: urlJoin(TEXTURE_BASE, '/skyboxes/sky_18_cubemap/'),
//     SKY_SUNSET: urlJoin(TEXTURE_BASE, '/skyboxes/sky_sunset/')
//   },

//   // 环境贴图
//   Environment: {
//     QWANTANI_MOONRISE_EXR: urlJoin(
//       TEXTURE_BASE,
//       '/environment/skies/qwantani_moonrise_puresky_2k/puresky.exr'
//     ),
//     QWANTANI_MOONRISE_HDR: urlJoin(
//       TEXTURE_BASE,
//       '/environment/skies/qwantani_moonrise_puresky_2k/puresky.hdr'
//     ),
//     EVENING_SKY_EXR: urlJoin(
//       TEXTURE_BASE,
//       '/environment/skies/EveningSkyHDRI039B/EveningSkyHDRI039B_2K-HDR.exr'
//     )
//   }
// }
