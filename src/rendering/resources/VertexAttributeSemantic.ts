/**
 * 引擎内置顶点属性使用的稳定语义名称。
 *
 * @remarks
 * 集中定义这些跨 Geometry、loader、shader reflection 与 backend 使用的字符串，
 * 可以避免 `position`/`positions` 或 `uv`/`texcoord` 等拼写漂移。
 *
 * 该对象只列出内置语义，不限制自定义 shader attribute。Geometry 仍然使用
 * `Record<string, VertexAttribute>`，因此 PRT transport、实例化矩阵等后续属性
 * 可以继续使用自定义名称。
 */
export const VertexAttributeSemantic = {
  Position: 'position',
  Normal: 'normal',
  UV: 'uv',
  Color: 'color'
} as const

/** `VertexAttributeSemantic` 中所有内置语义字符串的联合类型。 */
export type BuiltinVertexAttributeSemantic =
  (typeof VertexAttributeSemantic)[keyof typeof VertexAttributeSemantic]
