attribute vec3 aVertexPosition;
// attribute vec3 aNormalPosition
attribute vec2 aTextureCoord;

// MVP 矩阵
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// Gerstner wave 控制参数
// Gerstner wave 结构体（最多支持8个波）
struct GerstnerWave {
  vec2 direction; // 波浪传播方向
  float steepness; // 陡峭度
  float wavelength; // 波长
  float speedMultiplier; // 速度倍数
  float phase; // 相位偏移
};
uniform GerstnerWave uWaves[8];
uniform int uWaveCount; // Gerstner Wave 的个数
uniform float uTime; // t

// 传入 Fragment 中的 Varying
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vWorldPosition;
varying float vWaveHeight;

// constant variable
const float PI = 3.141592653589793;
const float TWO_PI = 6.283185307179586;
const float HALF_PI = 1.570796326794896;
const float g = 9.8;

/**
 * Gerstner 波函数
 * @param wave 波浪参数
 * @param pos 当前位置 (x, z)
 * @param time 当前时间
 * @return vec4(x_offset, y_offset, z_offset, normal_factor)
 */
vec3 calculateGerstnerWave(
  GerstnerWave wave,
  vec3 tangent,
  inout vec3 binormal,
  vec2 pos,
  float time,
  float stepnessSum
) {
  // 计算波数 k = 2π/λ
  float k = 2.0 * PI / wave.wavelength;

  // 计算波速 c = √(g/k)，g = 9.8
  float c = sqrt(g / k) * wave.speedMultiplier;

  // 归一化方向向量
  // vec2 dir = vec2(1.0, 1.0);
  // 替换为：
  vec2 dir = normalize(wave.direction);

  // 计算 phase = k * (p.x - wavespeed * time) * d.x + k * (p.z - wavespeed * time) * d.y;
  float phase = k * (dot(dir, pos) - c * time);
  // float phase = k * (pos.x - c * time) * dir.x + k * (pos.y - c * time) * dir.y;

  // 计算振幅 A = steepness / k
  // 为了规避 a * k > 1 所产生的错误情况，使用权重的方式设置所有波的 stepness ​​​​之和不大于 1
  float amplitude = wave.steepness / stepnessSum / k;

  // 计算三角函数值
  float cosPhase = cos(phase);
  float sinPhase = sin(phase);

  /**
 * 由于 Gerstner 波的点不能简单写成 y = h(x,z)，不再是“水面是某个函数的等高面”的情形（高度图不再存在），因此就不能直接写出 F(x,y,z) = y - h(x,z) = 0
 * 所以只能通过 计算切线 的方式来计算法向量
 * 水面为参数曲面 S(x,z) = (x + offsetX(x,z), offsetY, z + offsetZ(x,z))
 * 参数曲面在点 (x,z) 处的两个切向量为:
 * ∂S/∂x = ∂(x', y', z')/∂x  = (∂x'/∂x, ∂y'/∂x, ∂z'/∂x)
 * ∂S/∂z = ∂(x', y', z')/∂z  = (∂x'/∂z, ∂y'/∂z, ∂z'/∂z)
 * x' = x + d.x * Amplitude * cos(f);
 * y' = Amplitude * sin(f);
 * z' = z + d.y * Amplitude * cos(f);
 *  ∂x'/∂x = 1 - d.x * d.x * (Amplitude * k) * sin(f) = 1 - d.x * d.x * steepness * sin(f)
 */
  tangent += vec3(
    -dir.x * dir.x * wave.steepness * sinPhase,
    dir.x * wave.steepness * cosPhase,
    -dir.y * dir.x * wave.steepness * sinPhase
  );
  binormal += vec3(
    -dir.x * dir.y * wave.steepness * sinPhase,
    dir.y * wave.steepness * cosPhase,
    -dir.y * dir.y * wave.steepness * sinPhase
  );

  return vec3(
    // dir 为波的传播方向的单位向量，dir.x 和 dir.y 为 dir 在 x 和 z 轴上的投影，同时也等于 cosθ 和 sinθ，θ 为 dir 与 x 轴的夹角
    dir.x * amplitude * cosPhase, // x偏移
    amplitude * sinPhase, // y偏移（高度）
    dir.y * amplitude * cosPhase // z偏移
  );
}

void main() {
  vec2 pos = aVertexPosition.xz;
  vec3 tangent = vec3(1, 0, 0);
  vec3 binormal = vec3(0, 0, 1);
  vec3 finalPosition = aVertexPosition;
  vec3 finalNormal = vec3(0, 0, 0);
  float stepnessSum = 0.0;

  // 为了规避 a * k > 1 所产生的错误情况，使用权重的方式设置所有波的 stepness ​​​​之和不大于 1
  for (int i = 0; i < 8; i++) {
    if (i >= uWaveCount) break;
    stepnessSum += uWaves[i].steepness;
  }

  for (int i = 0; i < 8; i++) {
    if (i >= uWaveCount) break;
    finalPosition += calculateGerstnerWave(uWaves[i], tangent, binormal, pos, uTime, stepnessSum);
  }
  finalNormal = normalize(cross(binormal, tangent));

  /**
 * Debug Code
 *   finalPosition += calculateGerstnerWave(uWaves[0], tangent, binormal, pos, uTime);
 *   if (uWaveCount > 0) {
 *     // 只使用第一个波，并限制参数
 *     float k = 1.0; // 固定的小波数
 *     float phase = k * aVertexPosition.x - uTime;
 *     float amplitude = 1.0; // 固定的小振幅
 *
 *     finalPosition.y += amplitude * sin(phase);
 *     finalPosition.x += amplitude * 0.1 * cos(phase);
 *   }
 */

  vPosition = finalPosition;
  vWorldPosition = (uModelMatrix * vec4(finalPosition, 1.0)).xyz;
  vNormal = finalNormal;
  vTexCoord = aTextureCoord;
  vWaveHeight = finalPosition.y;

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(finalPosition, 1.0);
}
