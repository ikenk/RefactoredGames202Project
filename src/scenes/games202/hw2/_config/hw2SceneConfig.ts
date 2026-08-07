import { ModelPaths } from '@/models/_config/modelPaths'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { SH_ORDER2_LAYOUT } from '@/objects/prt/sphericalHarmonics/_config/shAttributeLayouts'
import { SH_ORDER2_LIGHT_LAYOUT } from '@/materials/prt/_config/shLightUniformLayouts'
import { Transform } from '@/objects/utils/Transform'
import { PRTScenePreset } from '../types/PRTScenePreset'
import { PRTDataDirectories } from '@/loaders/_config/prtDataPaths'
import { TexturePaths } from '@/textures/_config/texturePaths'

// const ENV_SHDATA_PATH = {
//   INDOOR: 'assets/hw2/SHData/Indoor',
//   CORNELL_BOX: 'assets/hw2/SHData/CornellBox',
//   GRACECATHEDRAL: 'assets/hw2/SHData/GraceCathedral',
//   SKYBOX: 'assets/hw2/SHData/Skybox'
// }

// const ENV_TEXTURE_PATH = {
//   INDOOR: 'assets/hw2/cubemap/Indoor',
//   CORNELL_BOX: 'assets/hw2/cubemap/CornellBox',
//   GRACECATHEDRAL: 'assets/hw2/cubemap/GraceCathedral',
//   SKYBOX: 'assets/hw2/cubemap/Skybox'
// }

const ENV_SHDATA_PATH = {
  INDOOR: PRTDataDirectories.INDOOR,
  CORNELL_BOX: PRTDataDirectories.CORNELL_BOX,
  GRACECATHEDRAL: PRTDataDirectories.GRACE_CATHEDRAL,
  SKYBOX: PRTDataDirectories.SKYBOX
} as const

const ENV_TEXTURE_PATH = {
  INDOOR: TexturePaths.HW2_CUBEMAP_INDOOR,
  CORNELL_BOX: TexturePaths.HW2_CUBEMAP_CORNELL_BOX,
  GRACECATHEDRAL: TexturePaths.HW2_CUBEMAP_GRACE_CATHEDRAL,
  SKYBOX: TexturePaths.HW2_CUBEMAP_SKYBOX
} as const

// ── 预设列表（GUI dropdown 的数据源）──

const SH_ORDER2_CONFIG = {
  attributeLayout: SH_ORDER2_LAYOUT,
  lightUniformLayout: SH_ORDER2_LIGHT_LAYOUT,
  vertShaderPath: ShaderPaths.TWO_ORDER_SH_VERTEX,
  fragShaderPath: ShaderPaths.TWO_ORDER_SH_FRAGMENT
} as const

// const SH_ORDER3_CONFIG = {
//   attributeLayout: SH_ORDER3_LAYOUT,
//   lightUniformLayout: SH_ORDER3_LIGHT_LAYOUT,
//   vertShaderPath: ShaderPaths.THREE_ORDER_SH_VERTEX,
//   fragShaderPath: ShaderPaths.THREE_ORDER_SH_FRAGMENT
// } as const

export const HW2_PRESETS: PRTScenePreset[] = [
  // ==================== Indoor ====================
  {
    label: 'Indoor / Mary / Shadowed',
    env: {
      dir: ENV_SHDATA_PATH.INDOOR,
      cubemapDir: ENV_TEXTURE_PATH.INDOOR,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'shadowed',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },
  {
    label: 'Indoor / Mary / Unshadowed',
    env: {
      dir: ENV_SHDATA_PATH.INDOOR,
      cubemapDir: ENV_TEXTURE_PATH.INDOOR,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'unshadowed',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },
  {
    label: 'Indoor / Mary / Interreflection',
    env: {
      dir: ENV_SHDATA_PATH.INDOOR,
      cubemapDir: ENV_TEXTURE_PATH.INDOOR,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'interreflection',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },

  // ==================== CornellBox ====================

  {
    label: 'CornellBox / Mary / Shadowed',
    env: {
      dir: ENV_SHDATA_PATH.CORNELL_BOX,
      cubemapDir: ENV_TEXTURE_PATH.CORNELL_BOX,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'shadowed',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },
  {
    label: 'CornellBox / Mary / Unshadowed',
    env: {
      dir: ENV_SHDATA_PATH.CORNELL_BOX,
      cubemapDir: ENV_TEXTURE_PATH.CORNELL_BOX,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'unshadowed',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },
  {
    label: 'CornellBox / Mary / Interreflection',
    env: {
      dir: ENV_SHDATA_PATH.CORNELL_BOX,
      cubemapDir: ENV_TEXTURE_PATH.CORNELL_BOX,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'interreflection',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },

  // ==================== GraceCathedral ====================

  {
    label: 'GraceCathedral / Mary / Shadowed',
    env: {
      dir: ENV_SHDATA_PATH.GRACECATHEDRAL,
      cubemapDir: ENV_TEXTURE_PATH.GRACECATHEDRAL,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'shadowed',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },
  {
    label: 'GraceCathedral / Mary / Unshadowed',
    env: {
      dir: ENV_SHDATA_PATH.GRACECATHEDRAL,
      cubemapDir: ENV_TEXTURE_PATH.GRACECATHEDRAL,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'unshadowed',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },
  {
    label: 'GraceCathedral / Mary / Interreflection',
    env: {
      dir: ENV_SHDATA_PATH.GRACECATHEDRAL,
      cubemapDir: ENV_TEXTURE_PATH.GRACECATHEDRAL,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'interreflection',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },

  // ==================== Skybox ====================
  {
    label: 'Skybox / Mary / Shadowed',
    env: {
      dir: ENV_SHDATA_PATH.SKYBOX,
      cubemapDir: ENV_TEXTURE_PATH.SKYBOX,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'shadowed',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },
  {
    label: 'Skybox / Mary / Unshadowed',
    env: {
      dir: ENV_SHDATA_PATH.SKYBOX,
      cubemapDir: ENV_TEXTURE_PATH.SKYBOX,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'unshadowed',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  },
  {
    label: 'Skybox / Mary / Interreflection',
    env: {
      dir: ENV_SHDATA_PATH.SKYBOX,
      cubemapDir: ENV_TEXTURE_PATH.SKYBOX,
      cubemapExtension: '.jpg',
      cubeMapsize: 100,
      faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
    },
    model: {
      path: ModelPaths.HW2_MARY,
      name: 'mary',
      transportType: 'interreflection',
      meshTransform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    sh: SH_ORDER2_CONFIG
  }
]
