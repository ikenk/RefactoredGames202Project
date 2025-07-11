export interface ShaderParameters {
  uniforms?: string[]
  attribs?: string[]
}

export interface ShaderProgram {
  glShaderProgram: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation>
  attribs: Record<string, GLint>
}
