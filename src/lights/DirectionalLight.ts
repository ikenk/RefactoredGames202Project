import { mat4 } from 'gl-matrix'

import type { Vec3 } from '@/types/math'
import type { LightUp, LightParams } from '@/types/light'
import type { Light } from '@/types/light'
import { FBO } from '@/textures/FBO'
import { Mesh } from '@/objects/Mesh'
import { setTransform } from '@/utils/transformation'
import { EmissiveMaterial } from '@/lights/Light'

/**
 * 定向光源类，用于3D渲染中的光照计算和阴影映射
 * @class DirectionalLight
 */
export class DirectionalLight implements Light {
  // public
  public mesh: Mesh
  public material: EmissiveMaterial
  public lightPos: LightParams['lightPos']
  public lightDir: LightParams['lightDir']
  public lightUp: LightUp
  public fbo: WebGLFramebuffer

  /**
   * 构造一个定向光源实例
   * @param {Array<number>} lightRadiance - 光源辐射度
   * @param {Array<number>} lightPos - 光源位置，格式为[x, y, z]
   * @param {LightParams['lightDir']} lightDir - 光源方向向量，包含x, y, z属性
   * @param {LightUp} lightUp - 光源上方向向量，用于构建视图矩阵，格式为[x, y, z]
   * @param {WebGLRenderingContext} gl - WebGL渲染上下文
   */
  constructor(
    lightRadiance: LightParams['lightRadiance'],
    lightPos: LightParams['lightPos'],
    lightDir: LightParams['lightDir'],
    lightUp: LightUp,
    gl: WebGLRenderingContext,
    gl_draw_buffers: WEBGL_draw_buffers
  ) {
    /**
     * 光源的可视化网格，创建一个0.1x0.1x0.1的小立方体用于显示光源位置
     * @type {Mesh}
     */
    this.mesh = Mesh.cube(setTransform(0, 0, 0, 0.1, 0.1, 0.1))

    this.material = new EmissiveMaterial(lightRadiance)

    this.lightPos = lightPos
    this.lightDir = lightDir
    this.lightUp = lightUp

    this.fbo = new FBO(gl, gl_draw_buffers).getFrameBuffer()
    // console.log(this.fbo)

    if (!this.fbo) {
      console.log('无法设置帧缓冲区对象')
      return
    }
  }

  /**
   * 计算着色方向
   * 返回光源方向的反向，用于光照计算中确定光线的入射方向(从shading point到光源)
   * @returns {Array<number>} 着色方向向量，格式为[x, y, z]
   */
  CalcShadingDirection(): Vec3 {
    let lightDir: Vec3 = [-this.lightDir['x'], -this.lightDir['y'], -this.lightDir['z']]
    return lightDir
  }

  /**
   * 计算光源的视图投影矩阵
   * 用于阴影映射，从光源的视角渲染场景
   * @returns {mat4} 光源的视图投影矩阵
   */
  CalcLightVP(): mat4 {
    let lightVP = mat4.create()
    let viewMatrix = mat4.create()
    let projectionMatrix = mat4.create()

    // View transform
    let focalPoint: Vec3 = [
      this.lightDir['x'] + this.lightPos[0],
      this.lightDir['y'] + this.lightPos[1],
      this.lightDir['z'] + this.lightPos[2]
    ]
    mat4.lookAt(viewMatrix, this.lightPos, focalPoint, this.lightUp)
    // Projection transform 由于定向光源（如太阳光）被认为是来自无限远处的平行光线，所以使用正交投影
    mat4.ortho(projectionMatrix, -10, 10, -10, 10, 1e-2, 1000)
    // VP transform lightVP = projectionMatrix × viewMatrix
    mat4.multiply(lightVP, projectionMatrix, viewMatrix)

    return lightVP
  }
}
