import { Shader } from '@/shaders/Shader'

import type { Uniforms } from '@/types/Material'

export class Material {
  // public
  public uniforms: Uniforms
  public attribs: string[]
  public frameBuffer: WebGLFramebuffer | null
  public notShadow: boolean
  // private
  private flatten_uniforms: string[]
  private flatten_attribs: string[]
  private vertexShaderContent: string
  private fragmentShaderContent: string
  // Uniforms is a map, attribs is a Array
  constructor(
    uniforms: Uniforms,
    attribs: string[],
    vertexShaderContent: string,
    fragmentShaderContent: string,
    frameBuffer: WebGLFramebuffer | null
  ) {
    this.uniforms = uniforms
    this.attribs = attribs
    this.vertexShaderContent = vertexShaderContent
    this.fragmentShaderContent = fragmentShaderContent

    this.flatten_uniforms = ['uViewMatrix', 'uModelMatrix', 'uProjectionMatrix', 'uCameraPos']
    for (let k in this.uniforms) {
      this.flatten_uniforms.push(k)
    }
    this.flatten_attribs = this.attribs

    this.frameBuffer = frameBuffer
    this.notShadow = false
  }

  setMeshAttribs(extraAttribs: string[]) {
    // console.log(extraAttribs)
    for (let i = 0; i < extraAttribs.length; i++) {
      this.flatten_attribs.push(extraAttribs[i])
    }
  }

  compile(gl: WebGLRenderingContext) {
    return new Shader(gl, this.vertexShaderContent, this.fragmentShaderContent, {
      uniforms: this.flatten_uniforms,
      attribs: this.flatten_attribs
    })
  }
}
