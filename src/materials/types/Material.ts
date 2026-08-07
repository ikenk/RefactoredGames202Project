import type { Vec2, Vec3, Vec4 } from '@/math/types/math'

/**
 * Shader Uniform 的类型标识。
 *
 * 该枚举用于描述 WebGL uniform 的数据类型，
 * 对应不同的 `gl.uniform*` API。
 *
 * 设计目的：
 * - 在 TypeScript 层明确 uniform 的数据结构
 * - 避免运行时类型判断
 * - 方便统一的 uniform 上传逻辑
 */
export enum UniformType {
  /**
   * 单个整数
   *
   * 对应 WebGL API：
   * `gl.uniform1i`
   *
   * 常见用途：
   * - 纹理采样器（sampler2D / samplerCube）
   * - 布尔值（WebGL 中 bool 实际上传为 int）
   */
  ONE_I = '1i',
  /**
   * 2 分量整数向量
   *
   * 对应：
   * `gl.uniform2iv`
   *
   * GLSL 类型：
   * `ivec2`
   */
  TWO_IV = '2iv',
  /**
   * 3 分量整数向量
   *
   * 对应：
   * `gl.uniform3iv`
   *
   * GLSL 类型：
   * `ivec3`
   */
  THREE_IV = '3iv',
  /**
   * 4 分量整数向量
   *
   * 对应：
   * `gl.uniform4iv`
   *
   * GLSL 类型：
   * `ivec4`
   */
  FOUR_IV = '4iv',

  /**
   * 单个浮点数
   *
   * 对应：
   * `gl.uniform1f`
   *
   * GLSL 类型：
   * `float`
   */
  ONE_F = '1f',
  /**
   * 2 分量浮点向量
   *
   * 对应：
   * `gl.uniform2fv`
   *
   * GLSL 类型：
   * `vec2`
   */
  TWO_FV = '2fv',
  /**
   * 3 分量浮点向量
   *
   * 对应：
   * `gl.uniform3fv`
   *
   * GLSL 类型：
   * `vec3`
   */
  THREE_FV = '3fv',
  /**
   * 4 分量浮点向量
   *
   * 对应：
   * `gl.uniform4fv`
   *
   * GLSL 类型：
   * `vec4`
   */
  FOUR_FV = '4fv',

  /**
   * 3x3 矩阵
   *
   * 对应：
   * `gl.uniformMatrix3fv`
   *
   * GLSL 类型：
   * `mat3`
   *
   */
  MATRIX_3FV = 'matrix3fv',

  /**
   * 4x4 矩阵
   *
   * 对应：
   * `gl.uniformMatrix4fv`
   *
   * GLSL 类型：
   * `mat4`
   *
   * 常见用途：
   * - Model Matrix
   * - View Matrix
   * - Projection Matrix
   */
  MATRIX_4FV = 'matrix4fv',

  /**
   * 2D 纹理采样器
   *
   * GLSL 类型：
   * `sampler2D`
   *
   * 上传流程：
   * 1. `gl.activeTexture`
   * 2. `gl.bindTexture`
   * 3. `gl.uniform1i`
   */
  TEXTURE_2D = 'texture',
  /**
   * 立方体贴图采样器
   *
   * GLSL 类型：
   * `samplerCube`
   *
   * 常用于：
   * - Skybox
   * - 环境贴图
   * - IBL
   */
  TEXTURE_CUBE = 'textureCube'

  // 将来可能需要：
  // FOUR_FV = '4fv',         // vec4，比如颜色 RGBA
  // MATRIX_3FV = 'matrix3fv' // mat3，法线矩阵常用
}

/**
 * 单个 Uniform 的数据结构。
 *
 * 每个 uniform 包含：
 * - `type`：uniform 类型
 * - `value`：实际上传的数据
 *
 * 使用 Discriminated Union（判别联合类型）
 * 来保证 `type` 与 `value` 的类型匹配。
 */
export type UniformEntry =
  /**
   * 单个整数 uniform
   */
  | { type: UniformType.ONE_I; value: number }
  /**
   * ivec2 uniform
   */
  | { type: UniformType.TWO_IV; value: Int32Array | Vec2 }
  /**
   * ivec3 uniform
   */
  | { type: UniformType.THREE_IV; value: Int32Array | Vec3 }
  /**
   * ivec4 uniform
   */
  | { type: UniformType.FOUR_IV; value: Int32Array | Vec4 }
  /**
   * 单个 float
   */
  | { type: UniformType.ONE_F; value: number }
  /**
   * vec2 uniform
   */
  | { type: UniformType.TWO_FV; value: Float32Array | Vec2 }
  /**
   * vec3 uniform
   */
  | { type: UniformType.THREE_FV; value: Float32Array | Vec3 }
  /**
   * vec4 uniform
   */
  | { type: UniformType.FOUR_FV; value: Float32Array | Vec4 }
  /**
   * mat3 uniform
   */
  | { type: UniformType.MATRIX_3FV; value: Float32Array | number[] }
  /**
   * mat4 uniform
   */
  | { type: UniformType.MATRIX_4FV; value: Float32Array | number[] }
  /**
   * 2D 纹理
   */
  | { type: UniformType.TEXTURE_2D; value: WebGLTexture | null }
  /**
   * CubeMap 纹理
   */
  | { type: UniformType.TEXTURE_CUBE; value: WebGLTexture | null }

/**
 * Shader Uniform 集合。
 *
 * key 为 uniform 在 shader 中的名称，
 * value 为对应的 uniform 数据。
 *
 * 示例：
 * ```ts
 * const uniforms: Uniforms = {
 *   uModelMatrix: {
 *     type: UniformType.MATRIX_4FV,
 *     value: modelMatrix
 *   },
 *   uColor: {
 *     type: UniformType.THREE_FV,
 *     value: [1, 0, 0]
 *   }
 * }
 * ```
 */
export interface Uniforms {
  [name: string]: UniformEntry
}

// export type Uniforms<T extends Record<string, UniformEntry>> = T // Deprecated
