import { CubeMapImagesConfig } from '@/loaders/types/loadCubeMapImages'
// import { ModelConfig } from '@/renderers/factories/meshRendererFromModel/types/ModelConfig'
import { SceneConfig } from '@/scenes/types/SceneConfig'

/** Cave 场景的配置 */
export interface CaveSceneConfig extends SceneConfig {
  /** 天空盒（可选，可以没有天空盒） */
  skybox?: CubeMapImagesConfig
}
