import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { BallSceneConfig } from '../types/BallSceneConfig'
import { Transform } from '@/objects/utils/Transform'
import { CubeMapImagesConfig } from '@/loaders/types/loadCubeMapImages'
import { ModelPaths } from '@/models/_config/modelPaths'
import { hw4Light } from '@/lights/directionalLight/_presets/hw4Lights'
import { Vec3 } from '@/math/types/math'
import { TexturePaths } from '@/textures/_config/texturePaths'

// ============================================================
//  LUT 纹理路径
// ============================================================

// export const LUT_PATHS = {
//   BALL_GGX_E_LUT: 'assets/hw4/ball/GGX_E_LUT.png',
//   BALL_GGX_E_MC_LUT: 'assets/hw4/ball/GGX_E_MC_LUT.png',
//   BALL_GGX_Eavg_LUT: 'assets/hw4/ball/GGX_Eavg_LUT.png',
//   SPHERE_GGX_E_LUT: 'assets/hw4/sphere/GGX_E_LUT.png',
//   SPHERE_GGX_Eavg_LUT: 'assets/hw4/sphere/GGX_Eavg_LUT.png'
// }

export const LUT_PATHS = {
  BALL_GGX_E_LUT: TexturePaths.HW4_BALL_GGX_E_LUT,
  BALL_GGX_E_MC_LUT: TexturePaths.HW4_BALL_GGX_E_MC_LUT,
  BALL_GGX_Eavg_LUT: TexturePaths.HW4_BALL_GGX_EAVG_LUT,
  SPHERE_GGX_E_LUT: TexturePaths.HW4_SPHERE_GGX_E_LUT,
  SPHERE_GGX_Eavg_LUT: TexturePaths.HW4_SPHERE_GGX_EAVG_LUT
} as const

// ============================================================
//  CubeMap 环境贴图路径
// ============================================================

// export const CORNELL_BOX_CUBEMAP: CubeMapImagesConfig = {
//   basePath: 'assets/hw4/cubemap/CornellBox/',
//   extension: '.jpg',
//   faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
// }

export const CORNELL_BOX_CUBEMAP: CubeMapImagesConfig = {
  basePath: TexturePaths.HW4_CUBEMAP_CORNELL_BOX,
  extension: '.jpg',
  faceKeys: ['posx', 'negx', 'posy', 'negy', 'posz', 'negz']
}

// ============================================================
//  Ball Scene Config
// ============================================================

/** 粗糙度序列（5 列） */
export const ROUGHNESS_LEVELS = [0.15, 0.35, 0.55, 0.75, 0.95]

/** 球体间距 */
const BALL_COL_SPACING = 15 // 列间距
const BALL_ROW_SPACING = 15 // 行间距
// const OFFSET_X = 0 // 上下排 Y 偏移（Assignment4 原版上排 y=0, 下排 y=-120）
// const OFFSET_Y = -15 // 上下排 Y 偏移（Assignment4 原版上排 y=0, 下排 y=-120）

/** 球体缩放 */
const BALL_SCALE_X = 20
const BALL_SCALE_Y = 20
const BALL_SCALE_Z = 20

/** 球体旋转 */
const BALL_ROTATION_X = 0
const BALL_ROTATION_Y = 180
const BALL_ROTATION_Z = 0

export const BALL_SCENE_CONFIG: BallSceneConfig = {
  cameraConfig: {
    position: [30, 0, 80],
    target: [30, 0, 0]
  },
  modelConfigs: [
    {
      path: ModelPaths.HW4_BALL,
      name: 'ball',
      format: 'gltf',
      vertShaderPath: ShaderPaths.HW4_COOK_TORRANCE_VERTEX,
      fragShaderPath: ShaderPaths.HW4_COOK_TORRANCE_FRAGMENT,
      transforms: createXYTranslationTransforms(
        1,
        ROUGHNESS_LEVELS.length,
        BALL_COL_SPACING,
        BALL_ROW_SPACING,
        0,
        0,
        [BALL_ROTATION_X, BALL_ROTATION_Y, BALL_ROTATION_Z],
        [BALL_SCALE_X, BALL_SCALE_Y, BALL_SCALE_Z]
      )
      // material: (
      //   funcName: string,
      //   rendererName: string,
      //   metallic: number, // 金属度 0~1
      //   roughness: number, // 粗糙度 0~1
      //   sharedTextures: SharedTextures
      // ) =>
      //   new CookTorranceMaterial(
      //     `${funcName} CookTorranceMaterial<${rendererName}>`,
      //     sharedTextures.albedoMap,
      //     metallic,
      //     roughness,
      //     sharedTextures.brdfLutMap,
      //     sharedTextures.envCubeTexture
      //   )
    },
    {
      path: ModelPaths.HW4_BALL,
      name: 'ball',
      format: 'gltf',
      vertShaderPath: ShaderPaths.HW4_KULLA_CONTY_VERTEX,
      fragShaderPath: ShaderPaths.HW4_KULLA_CONTY_FRAGMENT,
      transforms: createXYTranslationTransforms(
        1,
        ROUGHNESS_LEVELS.length,
        BALL_COL_SPACING,
        BALL_ROW_SPACING,
        0,
        -15,
        [BALL_ROTATION_X, BALL_ROTATION_Y, BALL_ROTATION_Z],
        [BALL_SCALE_X, BALL_SCALE_Y, BALL_SCALE_Z]
      )
      // material: (
      //   funcName: string,
      //   rendererName: string,
      //   metallic: number, // 金属度 0~1
      //   roughness: number, // 粗糙度 0~1
      //   sharedTextures: SharedTextures
      // ) =>
      //   new KullaContyMaterial(
      //     `${funcName} KullaContyMaterial<${rendererName}>`,
      //     sharedTextures.albedoMap,
      //     metallic,
      //     roughness,
      //     sharedTextures.brdfLutMap,
      //     sharedTextures.eavgLutMap,
      //     sharedTextures.envCubeTexture
      //   )
    }
  ],
  lightConfigs: [
    {
      id: 'HW4 Light',
      light: hw4Light
    }
  ],
  lutPaths: {
    BALL_GGX_E_LUT: LUT_PATHS.BALL_GGX_E_LUT,
    BALL_GGX_E_MC_LUT: LUT_PATHS.BALL_GGX_E_MC_LUT,
    BALL_GGX_Eavg_LUT: LUT_PATHS.BALL_GGX_Eavg_LUT
  },
  envCubeMapImagesConfig: CORNELL_BOX_CUBEMAP
}

// ==================== helper ====================
/** 为在 XY 平面上的多个物体准备的偏移矩阵集合 */
function createXYTranslationTransforms(
  rows: number,
  cols: number,
  colSpacing: number, // 列间距
  rowSpacing: number, // 行间距
  offsetX: number, // 整体在 X 轴上的偏移
  offsetY: number, // 整体在 Y 轴上的偏移
  rotation: Vec3,
  scale: Vec3
): Transform[] {
  const transforms: Transform[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const transform = new Transform(
        [offsetX + col * colSpacing, offsetY + row * rowSpacing, 0],
        rotation,
        scale
      )

      transforms.push(transform)
    }
  }

  return transforms
}
