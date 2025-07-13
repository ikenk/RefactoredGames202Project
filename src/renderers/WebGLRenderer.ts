import { MeshRender } from '@/renderers/MeshRender'
import { PerspectiveCamera } from 'three'

import type { LightObj } from '@/types/WebGLRenderer'
import type { UpdatedLightParamters } from '@/types/light'

export class WebGLRenderer {
  public gl: WebGLRenderingContext
  public gl_draw_buffers: WEBGL_draw_buffers
  public camera: PerspectiveCamera

  meshRenders: MeshRender[] = []
  shadowMesheRenders: MeshRender[] = []
  bufferMesheRenders: MeshRender[] = []
  lights: LightObj[] = []

  constructor(
    gl: WebGLRenderingContext,
    gl_draw_buffers: WEBGL_draw_buffers,
    camera: PerspectiveCamera
  ) {
    this.gl = gl
    this.gl_draw_buffers = gl_draw_buffers
    this.camera = camera
  }

  addLight(light: LightObj['entity']) {
    this.lights.push({
      entity: light,
      meshRender: new MeshRender(this.gl, light.mesh, light.material)
    })
  }
  addMeshRender(meshRender: MeshRender) {
    this.meshRenders.push(meshRender)
  }
  addShadowMeshRender(meshRender: MeshRender) {
    this.shadowMesheRenders.push(meshRender)
  }
  addBufferMeshRender(meshRender: MeshRender) {
    this.bufferMesheRenders.push(meshRender)
  }

  render() {
    console.assert(this.lights.length != 0, 'No light')
    console.assert(this.lights.length == 1, 'Multiple lights')
    let light = this.lights[0]

    const gl = this.gl
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clearDepth(1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // Update light parameters
    // 每一帧光源的位置、方向可能会变化，需要重新计算
    let lightVP = light.entity.CalcDirectionalLightVP()
    let lightDir = light.entity.CalcDirectionalShadingDirection()
    let updatedLightParamters: UpdatedLightParamters = {
      uLightVP: lightVP,
      uLightDir: lightDir
    }

    // Draw light
    light.meshRender.mesh.transform.translate = light.entity.lightPos
    light.meshRender.draw(this.camera, this.gl_draw_buffers, null, updatedLightParamters)
    // console.log(light.meshRender)

    // Shadow pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, light.entity.fbo)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    for (let i = 0; i < this.shadowMesheRenders.length; i++) {
      //   console.log(this.shadowMeshes[i])
      this.shadowMesheRenders[i].draw(
        this.camera,
        this.gl_draw_buffers,
        light.entity.fbo,
        updatedLightParamters
      )
      // this.shadowMeshes[i].draw(this.camera);
    }

    // Buffer pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.camera.fbo)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    for (let i = 0; i < this.bufferMesheRenders.length; i++) {
      this.bufferMesheRenders[i].draw(
        this.camera,
        this.gl_draw_buffers,
        this.camera.fbo,
        updatedLightParamters
      )
      // this.bufferMeshes[i].draw(this.camera);
    }

    // Camera pass
    for (let i = 0; i < this.meshRenders.length; i++) {
      this.meshRenders[i].draw(this.camera, this.gl_draw_buffers, null, updatedLightParamters)
    }
  }
}
