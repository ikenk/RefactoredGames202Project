/**
 * 顶点属性数据描述。
 *
 * 用于描述一个 Vertex Attribute 的数据布局，
 * 最终会通过 `gl.vertexAttribPointer()` 上传至 GPU。
 *
 * 一个 Attribute 通常对应 GLSL 中的：
 *
 * ```glsl
 * attribute vec3 aVertexPosition;
 * attribute vec3 aNormal;
 * attribute vec2 aTextureCoord;
 * ```
 *
 * 数据会被存入 Vertex Buffer Object (VBO) 中，
 * 并在渲染时绑定到对应的 attribute location。
 */
/**
 * 引擎内置的标准顶点属性名。
 *
 * 这些名字在引擎自带的 shader（gizmo / lighting / deferred / pbr）中统一约定，
 * `Mesh` 与各 RenderPass 依赖它们做 attribute location 缓存。
 */
export type BuiltinAttributeName =
  | 'aVertexPosition'
  | 'aNormalPosition'
  | 'aTextureCoord'
  | 'aTangent'
  | 'aColor'

export interface AttributeData {
  /**
   * attribute 在 shader 中的名称。
   *
   * 示例：
   * ```glsl
   * attribute vec3 aVertexPosition;
   * ```
   *
   * 类型写成 `BuiltinAttributeName | (string & {})` 而非纯 `string`：
   * `string & {}` 与 `string` 赋值等价，但不会在联合类型里被 TS 吸收合并，
   * 因此内置名仍能触发编辑器自动补全，同时允许各 pass 自带的自定义 attribute。
   *
   * 必须允许自定义名的原因：PRT（Precomputed Radiance Transfer）把每顶点的
   * 球谐传输系数（transport SH coefficients）按 3 个一组拆进多条 attribute
   * —— `aTransportSH0/1/2`（三阶 SH 共 9 个系数，见
   * `src/shaders/prt/sphericalHarmonics/order3/vertex.vert`）。
   * 这类逐场景的属性无法穷举进内置联合类型。
   */
  name: BuiltinAttributeName | (string & {})
  /**
   * 实际的顶点数据。
   *
   * 使用 TypedArray 存储以便直接上传至 GPU。
   *
   * 示例：
   * ```ts
   * new Float32Array([
   *   0,0,0,
   *   1,0,0,
   *   0,1,0
   * ])
   * ```
   */
  array: TypedArrayType
  /**
   * 每个顶点包含的分量数量。
   *
   * 对应 `gl.vertexAttribPointer()` 的 `size` 参数。
   *
   * 常见值：
   *
   * | size | GLSL 类型 |
   * |-----|-----------|
   * | 1 | float |
   * | 2 | vec2 |
   * | 3 | vec3 |
   * | 4 | vec4 |
   */
  size: number
  /**
   * 数据类型（WebGL 常量）。
   *
   * 对应 `gl.vertexAttribPointer()` 的 `type` 参数。
   *
   * 常见值：
   *
   * - `gl.FLOAT`
   * - `gl.UNSIGNED_BYTE`
   * - `gl.SHORT`
   */
  type: AttributeDataType
  /**
   * 是否将整数数据归一化为浮点数。
   *
   * 对应 `gl.vertexAttribPointer()` 的 `normalized` 参数。
   *
   * 示例：
   *
   * 若使用 `UNSIGNED_BYTE` 表示颜色：
   *
   * ```ts
   * [255,0,0] → vec3(1.0,0.0,0.0)
   * ```
   *
   * 默认值：
   *
   * ```ts
   * false
   * ```
   */
  normalized?: boolean
  /**
   * 每个顶点之间的字节间隔。
   *
   * 对应 `gl.vertexAttribPointer()` 的 `stride` 参数。
   *
   * 常见情况：
   *
   * - `0` 表示紧密排列（默认）
   * - interleaved buffer 时需要指定
   *
   * 示例（交错存储）：
   *
   * ```
   * position.xyz normal.xyz uv.xy
   * ```
   */
  stride?: number // 步长（默认 0，表示紧密排列）
  /**
   * Attribute 在 buffer 中的起始偏移。
   *
   * 对应 `gl.vertexAttribPointer()` 的 `offset` 参数。
   *
   * 单位：字节
   *
   * 示例：
   *
   * 若 position 在 interleaved buffer 开头：
   *
   * ```
   * offset = 0
   * ```
   */
  offset?: number // 偏移量（默认 0）
  /**
   * GPU 缓冲区使用方式提示（usage hint）。
   *
   * 对应 WebGL API：
   * `gl.bufferData(target, data, usage)`
   *
   * 该参数用于告诉 GPU 驱动：
   * **该缓冲区的数据更新频率**，从而帮助驱动选择更合适的内存策略。
   *
   * 常见取值：
   *
   * - `gl.STATIC_DRAW`
   *   - 数据几乎不会改变
   *   - 典型场景：静态模型、地形、建筑
   *
   * - `gl.DYNAMIC_DRAW`
   *   - 数据会被频繁更新
   *   - 典型场景：水面波浪、粒子系统、动画顶点
   *
   * 若未指定，通常默认使用：
   *
   * ```ts
   * gl.STATIC_DRAW
   * ```
   *
   * 注意：
   * 该值只是 性能提示 (hint)，WebGL 实现不保证一定按该策略分配内存。
   */
  usage?: WebGLRenderingContext['STATIC_DRAW'] | WebGLRenderingContext['DYNAMIC_DRAW']
}

/**
 * 支持的 TypedArray 类型。
 *
 * 这些类型可以直接传入 `gl.bufferData()`，
 * 用于创建 Vertex Buffer。
 */
type TypedArrayType = Float32Array | Int8Array | Uint8Array | Int16Array | Uint16Array

/**
 * Attribute 数据类型（WebGL 常量）。
 *
 * 对应 `gl.vertexAttribPointer()` 的 `type` 参数。
 *
 * WebGL 常量值：
 *
 * | 常量 | 数值 |
 * |-----|-----|
 * | FLOAT | 5126 |
 * | BYTE | 5120 |
 * | UNSIGNED_BYTE | 5121 |
 * | SHORT | 5122 |
 * | UNSIGNED_SHORT | 5123 |
 */
type AttributeDataType =
  | WebGLRenderingContext['FLOAT'] // 5126
  | WebGLRenderingContext['BYTE'] // 5120
  | WebGLRenderingContext['UNSIGNED_BYTE'] // 5121
  | WebGLRenderingContext['SHORT'] // 5122
  | WebGLRenderingContext['UNSIGNED_SHORT'] // 5123

// ============================================================

/**
 * 索引缓冲数据。
 *
 * 用于 Element Array Buffer (EBO / IBO)，
 * 通过 `gl.drawElements()` 绘制。
 *
 * 示例：
 *
 * ```ts
 * gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
 * gl.drawElements(gl.TRIANGLES, count, type, 0)
 * ```
 */
export interface IndexData {
  /**
   * 索引数组。
   *
   * 指向顶点数组中的顶点索引。
   *
   * 示例：
   *
   * ```
   * 0,1,2
   * 2,3,0
   * ```
   */
  array: Uint8Array | Uint16Array | Uint32Array
  /**
   * WebGL 索引类型。
   *
   * 对应 `gl.drawElements()` 的 `type` 参数。
   */
  type: IndexDataType
}

/**
 * 索引数据类型（WebGL 常量）。
 *
 * WebGL 支持三种索引类型：
 *
 * | 类型 | 最大顶点数 |
 * |-----|-----------|
 * | UNSIGNED_BYTE | 256 |
 * | UNSIGNED_SHORT | 65536 |
 * | UNSIGNED_INT | > 65536 |
 *
 * 注意：
 *
 * `UNSIGNED_INT` 在 WebGL1 中需要启用扩展：
 *
 * ```ts
 * OES_element_index_uint
 * ```
 */
type IndexDataType =
  | WebGLRenderingContext['UNSIGNED_BYTE'] // 5121
  | WebGLRenderingContext['UNSIGNED_SHORT'] // 5123
  | WebGLRenderingContext['UNSIGNED_INT'] // 5125
