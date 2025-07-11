import { Material } from '@/materials/Material'
import { getShaderString } from '@/loaders/loadShader'
import { Light } from '@/types/light'
import { PerspectiveCamera } from 'three'
import { Texture } from '@/textures/Texture'

class SSRMaterial extends Material {
  constructor(
    diffuseMap: Texture,
    specularMap: Texture,
    light: Light,
    camera: PerspectiveCamera,
    vertexShader: string,
    fragmentShader: string
  ) {
    let lightIntensity = light.mat.GetIntensity()
    let lightVP = light.CalcLightVP()
    let lightDir = light.CalcShadingDirection()

    super(
      {
        uLightRadiance: { type: '3fv', value: lightIntensity },
        uLightDir: { type: '3fv', value: lightDir },
        uGDiffuse: { type: 'texture', value: camera.fbo.textures[0] },
        uGDepth: { type: 'texture', value: camera.fbo.textures[1] },
        uGNormalWorld: { type: 'texture', value: camera.fbo.textures[2] },
        uGShadow: { type: 'texture', value: camera.fbo.textures[3] },
        uGPosWorld: { type: 'texture', value: camera.fbo.textures[4] }
      },
      [],
      vertexShader,
      fragmentShader,
      null
    )
  }
}

export async function buildSSRMaterial(
  diffuseMap: Texture,
  specularMap: Texture,
  light: Light,
  camera: PerspectiveCamera,
  vertexPath: string,
  fragmentPath: string
): Promise<SSRMaterial> {
  let vertexShader = await getShaderString(vertexPath)
  let fragmentShader = await getShaderString(fragmentPath)

  return new SSRMaterial(diffuseMap, specularMap, light, camera, vertexShader, fragmentShader)
}
