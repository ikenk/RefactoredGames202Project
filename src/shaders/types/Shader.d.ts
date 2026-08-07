export interface ShaderParameters {
  uniforms?: string[]
  attribs?: string[]
}

export interface ShaderProgram {
  glShaderProgram: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation>
  attribs: Record<string, GLint>
}

// export type ShaderType = 'vertex' | 'fragment' | 'compute'
// | 'program'
// export type ShaderStageType = 'vertex' | 'fragment' | 'compute'
// export type ShaderType = ShaderStageType | 'program'

export type ShaderStage = 'vertex' | 'fragment' | 'compute'
export type ShaderErrorKind = ShaderStage | 'program'

export type ShaderFile = ShaderPath & ShaderCode

export interface ShaderCode {
  vShaderCode: string
  fShaderCode: string
}

export interface ShaderPath {
  vShaderPath: string
  fShaderPath: string
}
