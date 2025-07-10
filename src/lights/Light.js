import { Material } from '@/materials/Material'
import { LightCubeVertexShader, LightCubeFragmentShader } from '@/shaders/InternalShader'

export class EmissiveMaterial extends Material {
  // public
  color

  constructor(lightRadiance) {
    super(
      {
        uLightRadiance: { type: '3fv', value: lightRadiance }
      },
      [],
      LightCubeVertexShader,
      LightCubeFragmentShader
    )

    this.color = lightRadiance
  }

  GetIntensity() {
    return this.color
  }
}
