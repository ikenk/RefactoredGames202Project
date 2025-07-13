import { Material } from '@/materials/Material'
import { getShaderString } from '@/loaders/loadShader'
import { DirectionalLight } from '@/lights/DirectionalLight'

import type { Vec3 } from '@/types/math'

export class DirectLightMaterial extends Material {
  constructor(
    color: Vec3,
    specular: Vec3,
    light: DirectionalLight,
    translate: Vec3,
    scale: Vec3,
    vertexShader: string,
    fragmentShader: string
  ) {
    let lightMVP = light.CalcDirectionalLightMVP(translate, scale)
    let lightIntensity = light.material.GetIntensity()

    super(
      {
        // Phong
        uSampler: { type: 'texture', value: color },
        uKs: { type: '3fv', value: specular },
        uLightRadiance: { type: '3fv', value: lightIntensity },
        // Shadow
        uShadowMap: { type: 'texture', value: light.fbo },
        uLightMVP: { type: 'matrix4fv', value: lightMVP }
      },
      [],
      vertexShader,
      fragmentShader,
      null
    )
  }
}

async function buildDirectLightMaterial(
  color: Vec3,
  specular: Vec3,
  light: DirectionalLight,
  translate: Vec3,
  scale: Vec3,
  vertexPath: string,
  fragmentPath: string
) {
  let vertexShader = await getShaderString(vertexPath)
  let fragmentShader = await getShaderString(fragmentPath)

  return new DirectLightMaterial(
    color,
    specular,
    light,
    translate,
    scale,
    vertexShader,
    fragmentShader
  )
}
