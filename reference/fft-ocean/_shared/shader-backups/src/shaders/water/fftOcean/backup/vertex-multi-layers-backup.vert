// prettier-ignore
#extension GL_EXT_shader_texture_lod : enable

attribute vec3 aVertexPosition;
// attribute vec3 aNormalPosition;
attribute vec2 aTextureCoord;

// MVP 矩阵
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// 位移纹理
uniform sampler2D uDisplacementMap0;
uniform sampler2D uDisplacementMap1;
uniform sampler2D uDisplacementMap2;
uniform sampler2D uDisplacementMap3;
uniform float uLayerSize0;
uniform float uLayerSize1;
uniform float uLayerSize2;
uniform float uLayerSize3;
// 每层 cascade 的采样侧混合权重（艺术量），默认 1.0
uniform float uLayerContribute0;
uniform float uLayerContribute1;
uniform float uLayerContribute2;
uniform float uLayerContribute3;

// 传入 Fragment 中的 Varying
// ----- 位置/光照计算专用的世界坐标 -----
// 做了 x + Dx * uChoppiness.x 和 z + Dz * uChoppiness.y 的偏移
varying vec3 vWorldPosition;
varying vec2 vWorldXZ;
// ----- 采样专用的世界坐标（未偏移） -----
varying vec2 vSampleWorldXZ;
varying float vWaveHeight;
varying float vClipDepth;
varying float vDisplacementY;

// const float DISPLAY_TILE0 = 0.04;
// const float DISPLAY_TILE1 = 0.06;
// const float DISPLAY_TILE2 = 0.12;
// const float DISPLAY_TILE3 = 0.18;

void main() {
  // ==================== 在 model space 采样和处理位移 ====================
  // uDisplacementMap 中的位移参数是在 model space 下确定的，因此应该将采样、放大放在 model space 下进行，然后再进行 world space 的转换

  vec2 worldXZ = (uModelMatrix * vec4(aVertexPosition, 1.0)).xz;

  /**
 * 4 层叠加位移
 *
 *    FFT 纹理在频域里假设空间是周期性的 L 米一个周期。也就是说这张 N×N 纹理物理上描述的是 L×L(uLayerSize * uLayerSize) 米见方的一小块海面，存的是那一小块的位移/梯度。
 *    反过来算各方案：
 *    1. uv = worldXZ / 2048（整张铺一次）：256m 的一个周期被强行拉伸到 2048m，波长被放大 8 倍，整个海面只看得到 1 个大 swell
 *    2.uv = worldXZ（不除）：每米一个周期，波长被压缩到 1m，视觉上就是极高频噪声
 *    3. uv = worldXZ / L（正确）：纹理按真实物理尺度平铺，波长保真
 *   
 *    本质：FFT 输出是"L 米样本"，视觉 mesh 比 L 大就必须 tile。每层各自的 L 不同,自然每层 uv 除以各自的 L。
 */
  // vec3 d0 = texture2D(uDisplacementMap0, worldXZ * DISPLAY_TILE0).rgb;
  // vec3 d1 = texture2D(uDisplacementMap1, worldXZ * DISPLAY_TILE1).xyz;
  // vec3 d2 = texture2D(uDisplacementMap2, worldXZ * DISPLAY_TILE2).xyz;
  // vec3 d3 = texture2D(uDisplacementMap3, worldXZ * DISPLAY_TILE3).xyz;
  vec3 d0 = texture2D(uDisplacementMap0, worldXZ / uLayerSize0).xyz;
  vec3 d1 = texture2D(uDisplacementMap1, worldXZ / uLayerSize1).xyz;
  vec3 d2 = texture2D(uDisplacementMap2, worldXZ / uLayerSize2).xyz;
  vec3 d3 = texture2D(uDisplacementMap3, worldXZ / uLayerSize3).xyz;
  vec3 displacement = d0 * uLayerContribute0 + d1 * uLayerContribute1 + d2 * uLayerContribute2 + d3 * uLayerContribute3;

  vec3 displacedModelPos = aVertexPosition + displacement;
  vec4 displacedWorldPos = uModelMatrix * vec4(displacedModelPos, 1.0);

  // ==================== 传递 varying ====================
  // vTexCoord 不再用 aTextureCoord；改成 worldXZ 传到 fragment
  vWorldPosition = displacedWorldPos.xyz;
  vWorldXZ = displacedWorldPos.xz;
  vSampleWorldXZ = worldXZ;
  vWaveHeight = max(displacement.y, 0.0); // 供片元 SSS 的 k1 使用
  // vClipDepth: 系数 50 是经验值，让 50m 处 clipDepth ≈ 1，远处趋近 0
  vec4 clipPos = uProjectionMatrix * uViewMatrix * displacedWorldPos;
  vClipDepth = clipPos.w > 0.0 ? clamp(1.0 / clipPos.w * 50.0, 0.0, 1.0) : 1.0;
  vDisplacementY = displacement.y;

  gl_Position = uProjectionMatrix * uViewMatrix * displacedWorldPos;
}

