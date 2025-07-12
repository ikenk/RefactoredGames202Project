import { setTransform } from '@/utils/transformation'
import { FBO } from '@/textures/FBO'

import type { Vec3 } from '@/types/math'
import { EmissiveMaterial } from '@/lights/Light'
import { Mesh } from '@/objects/Mesh'

export class PointLight {
  public gl: WebGLRenderingContext
  public gl_draw_buffers: WEBGL_draw_buffers
  public mesh: Mesh
  public material: EmissiveMaterial
  public fbo: WebGLFramebuffer

  /**
   * Creates an instance of PointLight.
   * @param {float} lightIntensity  The intensity of the PointLight.
   * @param {vec3f} lightColor The color of the PointLight.
   * @memberof PointLight
   */
  constructor(
    lightIntensity: number,
    lightColor: Vec3,
    gl: WebGLRenderingContext,
    gl_draw_buffers: WEBGL_draw_buffers
  ) {
    this.gl = gl
    this.gl_draw_buffers = gl_draw_buffers
    this.mesh = Mesh.cube(setTransform(0, 0, 0, 0.2, 0.2, 0.2, 0))

    const finalColor: Vec3 = [
      lightColor[0] * lightIntensity,
      lightColor[1] * lightIntensity,
      lightColor[2] * lightIntensity
    ]
    this.material = new EmissiveMaterial(finalColor)

    this.fbo = new FBO(this.gl, this.gl_draw_buffers).getFrameBuffer()
    if (!this.fbo) {
      console.log('无法设置帧缓冲区对象')
      return
    }
  }
}
