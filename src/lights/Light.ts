import { Material } from '@/materials/Material'
import { LightCubeVertexShader, LightCubeFragmentShader } from '@/shaders/InternalShader'

import type { LightParams } from '@/types/light'

export class EmissiveMaterial extends Material {
  // public
  private color: LightParams['lightRadiance']

  constructor(lightRadiance: LightParams['lightRadiance']) {
    super(
      {
        uLightRadiance: { type: '3fv', value: lightRadiance }
      },
      [],
      LightCubeVertexShader,
      LightCubeFragmentShader,
      null
    )

    this.color = lightRadiance
  }

  GetIntensity(): LightParams['lightRadiance'] {
    return this.color
  }
}
