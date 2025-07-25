import type { ShaderParameters, ShaderProgram } from '@/types/Shader'

export class Shader {
  private gl: WebGLRenderingContext
  public program: ShaderProgram

  constructor(
    gl: WebGLRenderingContext,
    vsSrc: string,
    fsSrc: string,
    shaderParameters: ShaderParameters
  ) {
    this.gl = gl
    const vs = this.compileShader(vsSrc, gl.VERTEX_SHADER)
    const fs = this.compileShader(fsSrc, gl.FRAGMENT_SHADER)

    this.program = this.addShaderLocations(
      {
        glShaderProgram: this.linkShader(vs, fs)
      },
      shaderParameters
    )
    // console.log(this.program)
  }

  compileShader(shaderSource: string, shaderType: GLenum): WebGLShader {
    let shader = this.gl.createShader(shaderType)
    this.gl.shaderSource(shader, shaderSource)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(shaderSource)
      console.error('shader compiler error:\n' + this.gl.getShaderInfoLog(shader))
    }

    return shader
  }

  linkShader(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram()
    this.gl.attachShader(program, vs)
    this.gl.attachShader(program, fs)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.log('shader linker error:\n' + this.gl.getProgramInfoLog(program))
      throw new Error('Failed to create program')
    }

    return program
  }

  addShaderLocations(
    glShaderProgramObj: Omit<ShaderProgram, 'uniforms' | 'attribs'>,
    shaderParameters: ShaderParameters
  ): ShaderProgram {
    const result = {
      ...glShaderProgramObj,
      uniforms: {},
      attribs: {}
    }
    // result.uniforms = {}
    // result.attribs = {}

    if (shaderParameters && shaderParameters.uniforms && shaderParameters.uniforms.length) {
      for (let i = 0; i < shaderParameters.uniforms.length; ++i) {
        result.uniforms = Object.assign(result.uniforms, {
          [shaderParameters.uniforms[i]]: this.gl.getUniformLocation(
            result.glShaderProgram,
            shaderParameters.uniforms[i]
          )
        })
      }
    }
    if (shaderParameters && shaderParameters.attribs && shaderParameters.attribs.length) {
      for (let i = 0; i < shaderParameters.attribs.length; ++i) {
        result.attribs = Object.assign(result.attribs, {
          [shaderParameters.attribs[i]]: this.gl.getAttribLocation(
            result.glShaderProgram,
            shaderParameters.attribs[i]
          )
        })
      }
    }

    return result
  }
}
