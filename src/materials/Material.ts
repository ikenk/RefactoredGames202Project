import { Shader } from '@/shaders/Shader'

interface Uniforms {
  [name: string]: { type: string; value: any }
}

export class Material {
  // public
  public uniforms: Uniforms
  public attribs: string[]
  public frameBuffer: WebGLFramebuffer | null
  public notShadow: boolean
  // private
  #flatten_uniforms: string[]
  #flatten_attribs: string[]
  #vsSrc: string
  #fsSrc: string
  // Uniforms is a map, attribs is a Array
  constructor(
    uniforms: Uniforms,
    attribs: string[],
    vsSrc: string,
    fsSrc: string,
    frameBuffer: WebGLFramebuffer | null
  ) {
    this.uniforms = uniforms
    this.attribs = attribs
    this.#vsSrc = vsSrc
    this.#fsSrc = fsSrc

    this.#flatten_uniforms = ['uViewMatrix', 'uModelMatrix', 'uProjectionMatrix', 'uCameraPos']
    for (let k in this.uniforms) {
      this.#flatten_uniforms.push(k)
    }
    this.#flatten_attribs = this.attribs

    this.frameBuffer = frameBuffer
    this.notShadow = false
  }

  setMeshAttribs(extraAttribs: string[]) {
    // console.log(extraAttribs)
    for (let i = 0; i < extraAttribs.length; i++) {
      this.#flatten_attribs.push(extraAttribs[i])
    }
  }

  compile(gl: WebGLRenderingContext) {
    return new Shader(gl, this.#vsSrc, this.#fsSrc, {
      uniforms: this.#flatten_uniforms,
      attribs: this.#flatten_attribs
    })
  }
}
