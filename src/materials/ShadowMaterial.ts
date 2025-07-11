import { Material } from '@/materials/Material'
import { getShaderString } from '@/loaders/loadShader'
import { Light } from '@/types/light'

class ShadowMaterial extends Material {
  constructor(light: Light, vertexShader: string, fragmentShader: string) {
    let lightVP = light.CalcLightVP()

    super(
      {
        uLightVP: { type: 'matrix4fv', value: lightVP }
      },
      [],
      vertexShader,
      fragmentShader,
      light.fbo
    )
  }
}

export async function buildShadowMaterial(
  light: Light,
  vertexPath: string,
  fragmentPath: string
): Promise<ShadowMaterial> {
  let vertexShader = await getShaderString(vertexPath)
  let fragmentShader = await getShaderString(fragmentPath)

  return new ShadowMaterial(light, vertexShader, fragmentShader)
}
