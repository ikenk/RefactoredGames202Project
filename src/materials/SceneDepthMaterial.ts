import { Material } from '@/materials/Material'
import { Texture } from '@/textures/Texture'
import { getShaderString } from '@/loaders/loadShader'

export class SceneDepthMaterial extends Material {
  constructor(
    color: Texture,
    vertexShader: string,
    fragmentShader: string,
    bufferFBO: WebGLFramebuffer
  ) {
    super(
      {
        uSampler: { type: 'texture', value: color }
      },
      [],
      vertexShader,
      fragmentShader,
      bufferFBO
    )
    this.notShadow = true
  }
}

async function buildSceneDepthMaterial(
  color: Texture,
  vertexPath: string,
  fragmentPath: string,
  bufferFBO: WebGLFramebuffer
): Promise<SceneDepthMaterial> {
  let vertexShader = await getShaderString(vertexPath)
  let fragmentShader = await getShaderString(fragmentPath)

  return new SceneDepthMaterial(color, vertexShader, fragmentShader, bufferFBO)
}
