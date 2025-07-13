import { setTransform } from '@/utils/transformation'
import { FBO } from '@/textures/FBO'

import type { Vec3 } from '@/types/math'
import { EmissiveMaterial } from '@/lights/Light'
import { Mesh } from '@/objects/Mesh'
import { Light, LightDir } from '@/types/light'
import { mat4 } from 'gl-matrix'

export class PointLight implements Light {
  public gl: WebGLRenderingContext
  public gl_draw_buffers: WEBGL_draw_buffers
  public mesh: Mesh
  public material: EmissiveMaterial
  public fbo: WebGLFramebuffer

  public lightPos: Vec3
  public lightIntensity: number
  public lightColor: Vec3

  /**
   * Creates an instance of PointLight.
   * @param {float} lightIntensity  The intensity of the PointLight.
   * @param {vec3f} lightColor The color of the PointLight.
   * @memberof PointLight
   */
  constructor(
    lightIntensity: number,
    lightColor: Vec3,
    lightPos: Vec3,
    gl: WebGLRenderingContext,
    gl_draw_buffers: WEBGL_draw_buffers
  ) {
    this.gl = gl
    this.gl_draw_buffers = gl_draw_buffers
    this.mesh = Mesh.cube(setTransform(0, 0, 0, 0.2, 0.2, 0.2, 0))

    this.lightPos = lightPos
    this.lightColor = lightColor
    this.lightIntensity = lightIntensity
    const finalColor: Vec3 = [
      this.lightColor[0] * this.lightIntensity,
      this.lightColor[1] * this.lightIntensity,
      this.lightColor[2] * this.lightIntensity
    ]
    this.material = new EmissiveMaterial(finalColor)

    this.fbo = new FBO(this.gl, this.gl_draw_buffers).getFrameBuffer()
    if (!this.fbo) {
      console.log('无法设置帧缓冲区对象')
      return
    }
  }
}
