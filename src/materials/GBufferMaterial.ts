import { Material } from '@/materials/Material'
import { getShaderString } from '@/loaders/loadShader'
import { PerspectiveCamera } from 'three'
import { Light } from '@/types/light'
import { Texture } from '@/textures/Texture'

export class GBufferMaterial extends Material {
  constructor(
    diffuseMap: Texture,
    normalMap: Texture,
    light: Light,
    camera: PerspectiveCamera,
    vertexShader: string,
    fragmentShader: string
  ) {
    let lightVP = light.CalcDirectionalLightVP()

    super(
      {
        uKd: { type: 'texture', value: diffuseMap.texture },
        uNt: { type: 'texture', value: normalMap.texture },

        uLightVP: { type: 'matrix4fv', value: lightVP },
        uShadowMap: { type: 'texture', value: light.fbo.textures[0] }
      },
      [],
      vertexShader,
      fragmentShader,
      camera.fbo
    )
  }
}

export async function buildGbufferMaterial(
  diffuseMap: Texture,
  normalMap: Texture,
  light: Light,
  camera: PerspectiveCamera,
  vertexPath: string,
  fragmentPath: string
): Promise<GBufferMaterial> {
  let vertexShader = await getShaderString(vertexPath)
  let fragmentShader = await getShaderString(fragmentPath)

  return new GBufferMaterial(diffuseMap, normalMap, light, camera, vertexShader, fragmentShader)
}
