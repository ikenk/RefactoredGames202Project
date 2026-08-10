import { vec2, vec3 } from 'gl-matrix'

export function calculateTangentBitangent(
  pos1: vec3,
  pos2: vec3,
  pos3: vec3,
  uv1: vec2,
  uv2: vec2,
  uv3: vec2
): {
  tangent: vec3
  bitangent: vec3
} {
  // 计算位置差值
  const edge1 = vec3.create()
  const edge2 = vec3.create()

  vec3.subtract(edge1, pos2, pos1)
  vec3.subtract(edge2, pos3, pos1)

  // 计算UV差值
  const deltaUV1 = vec2.create()
  const deltaUV2 = vec2.create()

  vec2.subtract(deltaUV1, uv2, uv1)
  vec2.subtract(deltaUV2, uv3, uv1)

  // 求解线性方程组：
  // edge1 = deltaUV1.x * T + deltaUV1.y * B
  // edge2 = deltaUV2.x * T + deltaUV2.y * B
  const tangent = vec3.create()
  const bitangent = vec3.create()

  const delta = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1])

  tangent[0] = delta * (deltaUV2[1] * edge1[0] - deltaUV1[1] * edge2[0])
  tangent[1] = delta * (deltaUV2[1] * edge1[1] - deltaUV1[1] * edge2[1])
  tangent[2] = delta * (deltaUV2[1] * edge1[2] - deltaUV1[1] * edge2[2])

  bitangent[0] = delta * (-deltaUV2[0] * edge1[0] + deltaUV1[0] * edge2[0])
  bitangent[1] = delta * (-deltaUV2[0] * edge1[1] + deltaUV1[0] * edge2[1])
  bitangent[2] = delta * (-deltaUV2[0] * edge1[2] + deltaUV1[0] * edge2[2])

  return { tangent, bitangent }
}
