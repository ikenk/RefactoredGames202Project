// prettier-ignore
#extension GL_EXT_shader_texture_lod : enable

#ifdef GL_ES
precision highp float;
#endif

uniform mat3 uNormalMatrix;

// 从 Vertex shader 传入的 Fragment varying
varying vec3 vWorldPosition;
varying vec2 vWorldXZ;
varying vec2 vSampleWorldXZ;
varying float vWaveHeight;
varying float vClipDepth;
varying float vDisplacementY;

// ============================================================
// 1 相机位置（占位，ForwardRenderPass 每帧注入）
//   视线 V = normalize(uCameraPos - vWorldPosition)
// ============================================================
uniform vec3 uCameraPos;

// ============================================================
// 2 光照几何（占位，LightSystem 每帧注入）
//   uLightDir       — shadingDirection = surface → light，即公式里的 L
//   uLightPos       — 方向光的参考位置（本 shader 不用，备用于阴影）
//   uLightRadiance  — 光源辐射度 L_i，出现在 specular 与 scatter 里
// ============================================================
uniform vec3 uLightRadiance;
uniform vec3 uLightPos;
uniform vec3 uLightDir;

// ============================================================
// 3 纹理开关（int 0|1，shader 里用 == 1 判断）
// ============================================================
uniform int uUseDiffuseMap;
uniform int uUseNormalMap;
uniform int uUseEnvironmentMap;

// ============================================================
// 4 基础贴图（按开关条件注入）
//   uDiffuseMap      — 备用，本 shader 未使用
//   uNormalMap       — 备用，法线由 FFT slope/jacobian 计算
//   uEnvironmentMap  — 立方体贴图，供 textureCube(reflect(-V,N)) 采样
//                     物理含义：环境辐射度 L_env(ω)，乘 Fresnel 参与最终输出
// ============================================================
uniform sampler2D uDiffuseMap;
uniform sampler2D uNormalMap;
uniform samplerCube uEnvironmentMap;
// IBL：prefiltered envmap（带 mip）+ BRDF LUT
uniform samplerCube uPrefilteredEnvMap; // mip 0..N 对应 roughness 0..1
uniform sampler2D uBRDFLUT; // u=NdotV, v=roughness
uniform float uMaxReflectionLod; // 通常 = numMips - 1 = 4.0

// // ============================================================
// // 5 水体颜色（均为线性空间 RGB，最后统一 Gamma 2.2）
// //   uDeepWaterColor     — 深水基色 C_deep，波谷/远处近似
// //   uShallowWaterColor  — 浅水基色 C_shallow，波峰/浅处近似
// //   uWaterColor         — 备用统一色（旧逻辑）
// //   用途：替代 SSS 的 k4 环境散射颜色，或作 base color 混合
// // ============================================================
// uniform vec3 uWaterColor;
// uniform vec3 uDeepWaterColor;
// uniform vec3 uShallowWaterColor;
// ============================================================
// 5 水体颜色（均为线性空间 RGB，最后统一 Gamma 2.2）
//   uAmbientColor — 环境散射颜色，作为水体颜色的兜底
//   uAmbientColor — 代替 Unity 的 ShadeSH9；建议填预计算的环境漫反射
// ============================================================
uniform vec3 uAmbientColor;

// ============================================================
// 6 水体物理参数
//   uTransparency     — 透明度 α，用于 gl_FragColor.a
//   uReflectance      — 反射率缩放（艺术控制）
//   uRefractiveIndex  — 折射率 η（海水≈1.33），参与 F0=((η-1)/(η+1))²
// ============================================================
uniform float uTransparency;
uniform float uReflectance;
uniform float uRefractiveIndex;

uniform float uSpecularStrength;
uniform float uFoamThreshold;

// ============================================================
// 7 水深模型（目前 shader 未消费，保留兼容）
// ============================================================
uniform int uDepthModel;
uniform float uMaxDepth;
uniform float uMinDepth;
uniform vec2 uDepthCenter;
uniform float uDepthFalloff;

// ============================================================
// 8 Cook-Torrance 参数
//   uRoughness        — 微表面 RMS 斜率 m，参与
//                       D: exp(−tan²θ_h/m²)/(π m² (n·h)⁴)
//                       G: a = (h·o)/(m·sin θ), Λ(a) 的 Schlick 逼近
//                       F: (1-n·v)^(5·e^(−2.69m)) / (1 + 22.7·m^1.5)
//   uSpecularPower    — 兼容旧 Blinn-Phong（过渡期保留；完全切换后可删）
//   uFresnelPower     — 同上，旧 Schlick 的指数
// ============================================================
uniform float uRoughness;
uniform float uFresnelPower;
uniform float uSpecularPower;
uniform float uFoamRoughness;

// ============================================================
// 9 Subsurface Scattering 四项强度与颜色
//   uWavePeakScatterStrength — σ_peak，k1 = σ_peak·H·(L·-V)⁴·(0.5−0.5 L·N)³
//                              控制逆光波峰透光感
//   uScatterStrength         — σ_view，k2 = σ_view·(V·N)²
//                              控制视线垂直穿水体时的体散射
//   uScatterShadowStrength   — σ_sh，k3 = σ_sh·(N·L)
//                              类 Lambert 方向散射
//   uAmbientDensity          — ρ_amb，k4 权重（环境散射强度）
//   uScatterColor            — C_scatter，k2/k3 使用的散射基色（近似体色）
//   uScatterPeakColor        — C_peak，k1 使用的波峰透光色（通常偏亮青）
//   uHeightStrength          — H 的缩放（让 k1 可调，匹配 uMagnificationY）
//   uShadowIntensity         — 阴影软化阈值：softShadow = sat(shadow + lift)
// ============================================================
uniform float uWavePeakScatterStrength;
uniform float uScatterStrength;
uniform float uScatterShadowStrength;
uniform float uAmbientDensity;
uniform vec3 uScatterColor;
uniform vec3 uScatterPeakColor;
uniform float uShadowIntensity;

// ============================================================
// 10 环境反射强度
//   uEnvirLightStrength — 乘到 textureCube 上，弥补 HDR 未解码的亮度差
// ============================================================
uniform float uEnvirLightStrength;

// // ============================================================
// // 11 FFT 几何放大
// //   uMagnificationXZ — 水平位移放大（choppiness 额外增益）
// //   uMagnificationY  — 垂直位移放大（波高增益；应与 SSS 的 H 保持一致）
// // ============================================================
// uniform float uMagnificationXZ; // 水平位移放大系数
// uniform float uMagnificationY; // 垂直位移放大系数
// ============================================================
// 11 FFT 几何放大
//   uNormalStrength — 水平位移放大（choppiness 额外增益）
//   uHeightStrength — H 的缩放（让 k1 可调，匹配 uMagnificationY）
// ============================================================
uniform float uNormalStrength;
uniform float uHeightStrength;

// ============================================================
// 12 每层 cascade 的 FFT 贴图与波长 L
//   uDisplacementMap[i] — (Dx, Dy, Dz, foam)，k1 从 layer0 的 .y 取 H
//   uGradientMap[i]     — (∂Dy/∂x, ∂Dy/∂z)，重建 meso 法线
//   uDispDerivativeMap[i] — (∂Dx/∂x, ∂Dz/∂z, ∂Dx/∂z, ∂Dz/∂x)，Jacobian
//   uLayerSize[i]       — 该层物理波长 L，用于 uv = worldXZ / L
// ============================================================
uniform sampler2D uDisplacementMap0;
uniform sampler2D uDisplacementMap1;
uniform sampler2D uDisplacementMap2;
uniform sampler2D uDisplacementMap3;
uniform sampler2D uGradientMap0;
uniform sampler2D uGradientMap1;
uniform sampler2D uGradientMap2;
uniform sampler2D uGradientMap3;
uniform sampler2D uDispDerivativeMap0;
uniform sampler2D uDispDerivativeMap1;
uniform sampler2D uDispDerivativeMap2;
uniform sampler2D uDispDerivativeMap3;
// FFT 计算时的海面大小（区分于显示在屏幕上的海面 Mesh 的大小）
uniform float uLayerSize0;
uniform float uLayerSize1;
uniform float uLayerSize2;
uniform float uLayerSize3;

// ============================================================
// 13 近/远法线过渡
// ============================================================
uniform float uVarMaskRange; // 默认 3.0
uniform float uVarMaskPower; // 默认 3.0
uniform float uVarMaskTexScale; // 默认 2.0

// ============================================================
// 14 Foam 参数
//   uFoamColor — foma 颜色
//   uFoamBias —
//   uFoamPower —
// ============================================================
uniform vec3 uFoamColor;
uniform float uFoamBias;
uniform float uFoamPower;

// ============================================================
// 15 远近衰减
// ============================================================
uniform float uDisplaceDepthAttenuation;
uniform float uFoamDepthAttenuation;

// ============================================================
// 每层 cascade 的采样侧混合权重（艺术量），默认 1.0
// ============================================================
uniform float uLayerContribute0;
uniform float uLayerContribute1;
uniform float uLayerContribute2;
uniform float uLayerContribute3;

// ============================================================
// 常量（经验拟合系数）
// ============================================================
const float PI = 3.14159265;
const float SCHLICK_A = 1.259;
const float SCHLICK_B = 0.396;
const float SCHLICK_C = 3.535;
const float SCHLICK_D = 2.181;
const float SCHLICK_CUTOFF = 1.6;
const float FRESNEL_ROUGH_EXP = 2.69;
const float FRESNEL_ENERGY_K = 22.7;
const float FRESNEL_ENERGY_P = 1.5;

// const float DISPLAY_TILE0 = 0.015625; // 1 / 64
// const float DISPLAY_TILE1 = 0.03125; // 1 / 32
// const float DISPLAY_TILE2 = 0.083333; // 1 / 12
// const float DISPLAY_TILE3 = 0.18; // ~1 / 5.6

const float DISPLAY_TILE0 = 0.04;
const float DISPLAY_TILE1 = 0.06;
const float DISPLAY_TILE2 = 0.12;
const float DISPLAY_TILE3 = 0.18;

// ==================== Helper ====================
// ---- 双曲正切的近似公式 ----
float tanh_approx(float x) {
  // 简单的双曲正切近似
  float ex = exp(2.0 * x);
  return (ex - 1.0) / (ex + 1.0);
}

float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// ---- 轻量 noise ----
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ---- 简单 hash ----
// 把 worldXZ 给到一个 [-0.5, 0.5] 范围的扰动
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 78.233);
  return fract(p.x * p.y);
}

// ==================== Sample ====================
// ---- tile method ----
vec2 sampleLayerSlopeByTile(sampler2D gradMap, float tile, float contribute) {
  vec2 uv = vSampleWorldXZ * tile;
  // return texture2D(gradMap, uv).rg * contribute;
  return texture2DLodEXT(gradMap, uv, 0.0).rg * contribute; // 强制 mip 0
}

float sampleLayerJacobianByTile(sampler2D dispDerivMap, float tile, float contribute) {
  vec2 uv = vSampleWorldXZ * tile;
  return mix(1.0, texture2DLodEXT(dispDerivMap, uv, 0.0).a, contribute);
}

// ---- layer size method ----
vec2 sampleLayerSlopeByLayerSize(sampler2D gradMap, float layerSize, float contribute) {
  vec2 uv = vSampleWorldXZ / layerSize;
  // return texture2D(gradMap, uv).rg * contribute;
  return texture2DLodEXT(gradMap, uv, 0.0).rg * contribute; // 强制 mip 0
}

float sampleLayerJacobianByLayerSize(sampler2D dispDerivMap, float layerSize, float contribute) {
  vec2 uv = vSampleWorldXZ / layerSize;
  return mix(1.0, texture2DLodEXT(dispDerivMap, uv, 0.0).a, contribute);
}

// ==================== 法线（原 vertex shader 中的流程，含 magnification 修正） ====================
// 原始平面上的点 (x, 0, z) 经过位移后变成: P(x,z) = (x + Dx(x,z),  Dy(x,z),  z + Dz(x,z))
// 要求法线，需要两个切向量: ∂P/∂x = (1 + ∂Dx/∂x, ∂Dy/∂x, ∂Dz/∂x) = (1 + dDx_dx, slope.x, dDz_dx) 和 ∂P/∂z = (∂Dx/∂z, ∂Dy/∂z, 1 + ∂Dz/∂z) = (dDx_dz, slope.y, 1 + dDz_dz)
struct SurfaceData {
  vec2 slope;
  vec3 normal;
  float jacobian;
};

// ---- tile method ----
SurfaceData calcSurfaceByTile() {
  vec2 slope0 = sampleLayerSlopeByTile(uGradientMap0, DISPLAY_TILE0, uLayerContribute0);
  vec2 slope1 = sampleLayerSlopeByTile(uGradientMap1, DISPLAY_TILE1, uLayerContribute1);
  vec2 slope2 = sampleLayerSlopeByTile(uGradientMap2, DISPLAY_TILE2, uLayerContribute2);
  vec2 slope3 = sampleLayerSlopeByTile(uGradientMap3, DISPLAY_TILE3, uLayerContribute3);

  vec2 slopeAll = slope0 + slope1 + slope2 + slope3;
  vec2 slopeLow = slope0 + slope1;
  vec2 slopeHigh = slope2 + slope3;

  // ---- 距离淡入：近处 0、远处 1 ----
  // 用相机水平距离更稳健；500 是参考里的"基准距离"，不要乱改
  float dist = length(uCameraPos.xz - vWorldPosition.xz);
  float invDepth = clamp(pow(dist / 500.0 * uVarMaskRange, uVarMaskPower), 0.0, 1.0);
  invDepth = clamp(invDepth, 0.0, 1.0);

  // ---- 噪声源：用 layer-0 displacement.y 做空间随机 ----
  // 0.001 * uVarMaskTexScale 让斑点尺度落到几百米量级（参考的 uv/1000）
  float noiseRaw = texture2DLodEXT(uDisplacementMap0, vWorldXZ * 0.001 * uVarMaskTexScale, 0.0).y;
  // displacement.y 是有符号的米级数值，归一化到 [0,1]
  float noise01 = clamp(noiseRaw * 0.5 + 0.5, 0.0, 1.0);

  // ---- 二值化（参考里的 *4 + saturate）----
  float varMask = clamp(noise01 * 4.0 * invDepth, 0.0, 1.0);

  // NormalStrength 缩放（默认 0.2）
  vec2 finalSlope = mix(slopeAll, slopeHigh, varMask) * uNormalStrength;

  vec3 n = normalize(vec3(-finalSlope.x, 1, -finalSlope.y));

  float j0 = sampleLayerJacobianByTile(uDispDerivativeMap0, DISPLAY_TILE0, uLayerContribute0);
  float j1 = sampleLayerJacobianByTile(uDispDerivativeMap1, DISPLAY_TILE1, uLayerContribute1);
  float j2 = sampleLayerJacobianByTile(uDispDerivativeMap2, DISPLAY_TILE2, uLayerContribute2);
  float j3 = sampleLayerJacobianByTile(uDispDerivativeMap3, DISPLAY_TILE3, uLayerContribute3);

  float jacobian = j0 * j1 * j2 * j3;

  SurfaceData sd;
  sd.slope = finalSlope;
  sd.normal = n;
  sd.jacobian = jacobian;

  return sd;
}

// ---- layer size method ----
SurfaceData calcSurfaceByLayerSize() {
  vec2 slope0 = sampleLayerSlopeByLayerSize(uGradientMap0, uLayerSize0, uLayerContribute0);
  vec2 slope1 = sampleLayerSlopeByLayerSize(uGradientMap1, uLayerSize1, uLayerContribute1);
  vec2 slope2 = sampleLayerSlopeByLayerSize(uGradientMap2, uLayerSize2, uLayerContribute2);
  vec2 slope3 = sampleLayerSlopeByLayerSize(uGradientMap3, uLayerSize3, uLayerContribute3);

  vec2 slopeAll = slope0 + slope1 + slope2 + slope3;
  vec2 slopeLow = slope0 + slope1;
  vec2 slopeHigh = slope2 + slope3;

  // ---- 距离淡入：近处 0、远处 1 ----
  // 用相机水平距离更稳健；500 是参考里的"基准距离"，不要乱改
  float dist = length(uCameraPos.xz - vWorldPosition.xz);
  float invDepth = clamp(pow(dist / 500.0 * uVarMaskRange, uVarMaskPower), 0.0, 1.0);
  invDepth = clamp(invDepth, 0.0, 1.0);

  // ---- 噪声源：用 layer-0 displacement.y 做空间随机 ----
  // 0.001 * uVarMaskTexScale 让斑点尺度落到几百米量级（参考的 uv/1000）
  float noiseRaw = texture2DLodEXT(uDisplacementMap0, vWorldXZ * 0.001 * uVarMaskTexScale, 0.0).y;
  // displacement.y 是有符号的米级数值，归一化到 [0,1]
  float noise01 = clamp(noiseRaw * 0.5 + 0.5, 0.0, 1.0);

  // ---- 二值化（参考里的 *4 + saturate）----
  float varMask = clamp(noise01 * 4.0 * invDepth, 0.0, 1.0);

  // NormalStrength 缩放（默认 0.2）
  // vec2 finalSlope = mix(slopeAll, slopeHigh, varMask) * uNormalStrength;
  vec2 finalSlope = slopeAll * uNormalStrength;

  // vec3 tangentX = vec3(1.0 + dDx_dx, grad.x, dDz_dx);
  // vec3 tangentZ = vec3(dDx_dz, grad.y, 1.0 + dDz_dz);
  // vec3 n = normalize(cross(tangentZ, tangentX));
  vec3 n = normalize(vec3(-finalSlope.x, 1, -finalSlope.y));

  float j0 = sampleLayerJacobianByLayerSize(uDispDerivativeMap0, uLayerSize0, uLayerContribute0);
  float j1 = sampleLayerJacobianByLayerSize(uDispDerivativeMap1, uLayerSize1, uLayerContribute1);
  float j2 = sampleLayerJacobianByLayerSize(uDispDerivativeMap2, uLayerSize2, uLayerContribute2);
  float j3 = sampleLayerJacobianByLayerSize(uDispDerivativeMap3, uLayerSize3, uLayerContribute3);

  float jacobian = j0 * j1 * j2 * j3;

  SurfaceData sd;
  sd.slope = finalSlope;
  sd.normal = n;
  sd.jacobian = jacobian;

  return sd;
}

// ============================================================
// Cook-Torrance (Beckmann + Smith)
//   f_r = D·F·G / ( 4·(n·l)·(n·v) )
//   这里 n 取 meso（中观）法线，分母的 (n·l) 换成 macro 法线以避免除零
// ============================================================

// ---- D：Beckmann 法线分布 ----
// D(h) = exp( ((n·h)^2 - 1) / (m^2 (n·h)^2) ) / ( π m^2 (n·h)^4 )
// 物理含义：微表面法线在 h 方向上的分布密度；m 越大表面越粗糙
// m -- roughness
float BeckmannNDF(float nDoth, float roughness) {
  float nh2 = nDoth * nDoth;
  float roughness2 = roughness * roughness;
  float expArg = (nh2 - 1.0) / (roughness2 * nh2); // = -tan²θ_h / m²
  return exp(expArg) / (PI * roughness2 * nh2 * nh2);
}

// ---- G：Smith-Beckmann 单侧 Λ(o)，Schlick 有理逼近 ----
// a = (h·o) / ( m · sqrt(1 - (h·o)^2) )
// Λ(o) ≈ (1 - 1.259a + 0.396a²) / (3.535a + 2.181a²)   when a < 1.6
//       ≈ 0                                             when a ≥ 1.6
// m -- roughness
// 物理含义：从 o 方向看，有多大比例的微表面被自身其它微表面遮蔽
float SmithMaskBeckmann(vec3 h, vec3 o, float m) {
  float hDoto = max(0.001, clamp(dot(h, o), 0.0, 1.0));
  float a = hDoto / (m * sqrt(max(1.0 - hDoto * hDoto, 1e-5)));

  float a2 = a * a;
  if (a >= SCHLICK_CUTOFF) return 0.0;
  return (1.0 - SCHLICK_A * a + SCHLICK_B * a2) / (SCHLICK_C * a + SCHLICK_D * a2);
}

// ---- F：粗糙度修正 Schlick Fresnel ----
// F0 = ((η-1)/(η+1))²
// F  = F0 + (1-F0) · (1-n·v)^(5·e^(-2.69m)) / (1 + 22.7·m^1.5)
// 物理含义：入射光在水面反射的比例，随 grazing angle 增大
float FresnelSchlickRough(vec3 normal, vec3 viewDir, float roughness, float eta) {
  float F0 = (eta - 1.0) / (eta + 1.0);
  F0 = F0 * F0;
  float cosNV = max(dot(normal, viewDir), 0.0);
  float expo = 5.0 * exp(-FRESNEL_ROUGH_EXP * roughness); // 粗糙度让曲线变缓
  float num = pow(1.0 - cosNV, expo);
  float denom = 1.0 + FRESNEL_ENERGY_K * pow(roughness, FRESNEL_ENERGY_P); // 能量归一化
  return clamp(F0 + (1.0 - F0) * num / denom, 0.0, 1.0);
}

// ---- 组装 specular ----
// L_spec = D·F·G·Li·S / ( 4·(n_macro·l) )  · (n_meso·l)
// 用 n_macro 归一化避免掠射角除零爆点；再乘回 n_meso·l 恢复几何朝向
vec3 cookTorranceSpecular(
  vec3 nMeso,
  vec3 nMacro,
  vec3 lightDir,
  vec3 viewDir,
  vec3 lightColor,
  float roughness,
  float eta,
  float shadow
) {
  vec3 halfDir = normalize(lightDir + viewDir);
  float nDoth = max(dot(nMeso, halfDir), 0.001);
  float nDotl_m = max(dot(nMeso, lightDir), 0.001);
  float nDotl_M = max(dot(nMacro, lightDir), 0.001);

  float D = BeckmannNDF(nDoth, roughness);
  float F = FresnelSchlickRough(nMeso, viewDir, roughness, eta);
  // prettier-ignore
  float G = 1.0 / (1.0
           + SmithMaskBeckmann(halfDir, viewDir, roughness)   // Λ(v) masking
           + SmithMaskBeckmann(halfDir, lightDir, roughness)); // Λ(l) shadowing

  return lightColor * (D * F * G) / (4.0 * nDotl_M) * nDotl_m * shadow;
}

// ============================================================
// Subsurface Scattering (四项经验模型)
// ============================================================
// k1：波峰峰值散射（逆光波峰透光）
//   k1 = σ_peak · H · (L·-V)^4 · (0.5 - 0.5·L·N)^3
// k2：视角体散射  k2 = σ_view · (V·N)^2
// k3：方向漫射    k3 = σ_sh   · (N·L)
// k4：环境散射    k4 = ρ_amb  （后面乘 ambientColor）
//
// 合成：
//   scatter = (k1·C_peak + k2·C_scat)·Li/(1+Λ(l))·S̃
//           +  k3·C_scat·Li·S̃
//           +  k4·C_amb
// ============================================================
vec3 subsurfaceScattering(
  vec3 nMeso,
  vec3 L,
  vec3 V,
  float waveHeight,
  vec3 lightColor,
  vec3 ambientColor,
  float shadow,
  float shadowLift,
  float lightMask
) {
  float LdotNegV = max(dot(L, -V), 0.0);
  float LdotN = dot(L, nMeso);
  float VdotN = max(dot(V, nMeso), 0.0);
  float NdotL = max(dot(nMeso, L), 0.0);

  // k1：H 越高、越逆光（L·-V↑）、光越从背面穿来（L·N→-1）时越亮
  // float k1 = uWavePeakScatterStrength * waveHeight * pow(LdotNegV, 4.0) * pow(0.5 - 0.5 * LdotN, 3.0);
  float k1 = uWavePeakScatterStrength * waveHeight * pow(max(0.0, LdotNegV), 4.0) * pow(0.5 - 0.5 * LdotN, 3.0);
  k1 = mix(0.0, k1, pow(clamp(vClipDepth, 0.0, 1.0), uDisplaceDepthAttenuation));

  // k2：视线越垂直穿过水体（V·N 大），散射越强
  // float k2 = uScatterStrength * pow(VdotN, 2.0);
  float k2 = uScatterStrength * pow(max(0.0, VdotN), 2.0);

  // k3：类 Lambert，随光源入射角变化
  float k3 = uScatterShadowStrength * NdotL;

  // k4：恒定环境散射权重
  float k4 = uAmbientDensity;

  // 软化阴影：shadow=0 仍保留 shadowLift 的散射亮度
  float softShadow = clamp(shadow + shadowLift, 0.0, 1.0);

  // prettier-ignore
  vec3 scatter = (k1 * uScatterPeakColor + k2 * uScatterColor)
              //  * lightColor
               * (1.0 / (1.0 + lightMask))   // 光源端 masking
               * softShadow;

  // scatter += k3 * uScatterColor * lightColor * softShadow;
  scatter += k3 * uScatterColor * softShadow;
  scatter += k4 * ambientColor; // SH9 在 GLSL 中用常量环境色代替
  return scatter;
}

// =====================================================================
// IBL specular（split-sum 近似）
// 物理：∫ L_i · f_spec · cos θ dω
//      ≈ [按 roughness 采 prefilteredEnv] · [BRDF LUT 给的 (scale, bias)]
//
// reflectDir = reflect(-V, N)        view 反射方向，用于 envmap 采样
// uRoughness                         材质粗糙度 ∈ [0, 1]
// NdotV                              视角与法线夹角余弦
// F0                                 水的菲涅尔基色（n=1.33 推出 ≈ 0.02）
// =====================================================================
vec3 calEnvReflect(vec3 normal, vec3 viewDir, vec3 reflectDir) {
  float NdotV = max(dot(normal, viewDir), 0.0);

  // 1) 按 roughness 选 mip level：mip 0 = 完全镜面、mip max = 完全粗糙
  float lod = uRoughness * uMaxReflectionLod;
  vec3 prefilteredColor = textureCubeLodEXT(uPrefilteredEnvMap, reflectDir, lod).rgb;
  // vec3 prefilteredColor = textureCube(uPrefilteredEnvMap, reflectDir).rgb;

  // 2) 从 LUT 查 BRDF 积分的 (scale, bias)
  //    NdotV ∈ [0, 1] 直接当 u；roughness ∈ [0, 1] 当 v
  vec2 envBRDF = texture2D(uBRDFLUT, vec2(NdotV, uRoughness)).rg;

  // 3) Fresnel F0：水的折射率 n ≈ 1.33 → F0 = ((n-1)/(n+1))² ≈ 0.02
  //    水是无色电介质，三通道相同
  vec3 F0 = vec3(0.02);

  // 4) split-sum 合成：iblSpec = prefilteredColor · (F0 · scale + bias)
  vec3 envReflect =
    uUseEnvironmentMap == 1
      ? prefilteredColor * (F0 * envBRDF.x + envBRDF.y) * uEnvirLightStrength
      : vec3(0.0);

  return envReflect;
  // return prefilteredColor;
}

// ============================================================
// Optical Depth / Beer-Lambert 吸收（光程透射率）
// ============================================================
// 功能：计算水面光的透射率 T = exp(-σ·d)，考虑水深和波峰/波谷的影响
//
// 参数说明：
//   surfHeight   — 当前 fragment 的水面高度（相对静水面，单位 m）
//                  crest → 正值，trough → 负值
//   baseDepth    — 经验常数，表示平均光程长度（m），典型取值 2~5
//   absorption   — RGB 通道独立吸收系数 σ (1/m)
//                  水越清澈 σ 越小；清澈海水示例：vec3(0.6, 0.15, 0.04)
//
// 物理解释：
//   1. 光程修正（waveModulation）
//      - crest：surfHeight > 0 → 光程短 → T ↑ → 颜色亮
//      - trough：surfHeight < 0 → 光程长 → T ↓ → 颜色暗、偏蓝绿
//      waveModulation = -surfHeight * 0.3
//
//   2. 光程长度（opticalLength）
//      opticalLength = baseDepth + waveModulation
//      钳到最小值 0.1m 避免指数溢出或负值
//
//   3. Beer-Lambert 公式（每通道独立）
//      T = exp(-σ·d)
//      示例：baseDepth=3m, σ_R=0.6 → T_R = exp(-0.6*3)=0.165
//             σ_G=0.15 → T_G = exp(-0.15*3)=0.637
//             σ_B=0.04 → T_B = exp(-0.04*3)=0.886
//      解释：红光吸收最快、绿光中等、蓝光最慢 → 深水看起来偏蓝绿
//
// 返回值：
//   vec3 transmittance — RGB 透射率，范围 [0,1]
//
// ============================================================
vec3 calcTransmittance(float surfHeight, float baseDepth, vec3 absorption) {
  // 1. 光程修正
  float waveModulation = -surfHeight * 0.3;

  // 2. 光程长度，钳到最小 0.1 m
  float opticalLength = max(0.1, baseDepth + waveModulation);

  // 3. Beer-Lambert 公式，计算每个通道透射率
  vec3 transmittance = exp(-absorption * opticalLength);

  return transmittance;
}

// ============================================================
// Foam
// ============================================================
// Jacobian 描述“局部压缩”，理论上 J≤0 才会破碎产生泡沫，
// 但实际渲染中用 J < bias 提前触发，从而得到稳定、连续且视觉合理的泡沫分布
// float calcFoam(float jacobian, float shadow) {
//   // 当 jacobian < uFoamBias 时开始出现泡沫（不用等到 J=0 才有泡沫，提前开始）
//   float foam = clamp(-(jacobian - uFoamBias), 0.0, 1.0);
//   // 控制泡沫“锐度”（uFoamPower<1 => 更平滑，uFoamPower>1 => 更集中在强破碎）
//   foam = pow(foam, uFoamPower);
//   // 阴影软化
//   foam *= clamp(shadow + uShadowIntensity, 0.0, 1.0);
//   return foam;
// }

float calcFoamByTile(float shadow) {
  float foam =
    uLayerContribute0 * texture2DLodEXT(uDisplacementMap0, vSampleWorldXZ * DISPLAY_TILE0, 0.0).a +
    uLayerContribute1 * texture2DLodEXT(uDisplacementMap1, vSampleWorldXZ * DISPLAY_TILE1, 0.0).a +
    uLayerContribute2 * texture2DLodEXT(uDisplacementMap2, vSampleWorldXZ * DISPLAY_TILE2, 0.0).a +
    uLayerContribute3 * texture2DLodEXT(uDisplacementMap3, vSampleWorldXZ * DISPLAY_TILE3, 0.0).a;
  foam = clamp(foam, 0.0, 1.0);
  // 阴影软化
  foam *= clamp(shadow + uShadowIntensity, 0.0, 1.0);
  return foam;
}

float calcFoamByLayerSize(float shadow) {
  // float foam =
  //   uLayerContribute0 * texture2DLodEXT(uDisplacementMap0, vSampleWorldXZ / uLayerSize0, 0.0).a +
  //   uLayerContribute1 * texture2DLodEXT(uDisplacementMap1, vSampleWorldXZ / uLayerSize1, 0.0).a +
  //   uLayerContribute2 * texture2DLodEXT(uDisplacementMap2, vSampleWorldXZ / uLayerSize2, 0.0).a +
  //   uLayerContribute3 * texture2DLodEXT(uDisplacementMap3, vSampleWorldXZ / uLayerSize3, 0.0).a;

  float foam =
    uLayerContribute0 * texture2D(uDisplacementMap0, vSampleWorldXZ / uLayerSize0).a +
    uLayerContribute1 * texture2D(uDisplacementMap1, vSampleWorldXZ / uLayerSize1).a +
    uLayerContribute2 * texture2D(uDisplacementMap2, vSampleWorldXZ / uLayerSize2).a +
    uLayerContribute3 * texture2D(uDisplacementMap3, vSampleWorldXZ / uLayerSize3).a;
  foam = clamp(foam, 0.0, 1.0);
  // 阴影软化
  foam *= clamp(shadow + uShadowIntensity, 0.0, 1.0);
  return foam;
}

void main() {
  bool useTile = false;
  SurfaceData surf;
  if (useTile) {
    surf = calcSurfaceByTile();
  } else {
    surf = calcSurfaceByLayerSize();
  }

  // ---------- normal ----------
  vec3 nMacro = vec3(0.0, 1.0, 0.0);
  vec3 nMeso = surf.normal;
  nMeso = mix(nMacro, nMeso, pow(clamp(vClipDepth, 0.0, 1.0), uDisplaceDepthAttenuation));
  nMeso = normalize(uNormalMatrix * nMeso);

  // ---------- foam ----------
  // J=1 时平衡，J 越小越压缩 → foam 累积
  float shadow = 1.0;
  // float foam = calcFoam(surf.jacobian, shadow);
  // float foam = calcFoamByTile(shadow);
  float foam = calcFoamByLayerSize(shadow);

  // ---------- vectors / direction ----------
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);
  vec3 lightDir = normalize(uLightDir);
  vec3 halfDir = normalize(viewDir + lightDir);
  vec3 reflectDir = normalize(reflect(-viewDir, nMeso));

  // ---------- roughness ----------
  // float roughness = uRoughness;
  float roughness = uRoughness + foam * uFoamRoughness;

  // ---------- mask ----------
  // 复用 Λ(l)，给 SSS 使用
  float lightMask = SmithMaskBeckmann(halfDir, lightDir, roughness);
  float viewMask = SmithMaskBeckmann(halfDir, viewDir, roughness);
  float geometryMask = 1.0 / (1.0 + viewMask + lightMask);

  // ---------- dot ----------
  float nDotl = max(0.001, clamp(dot(nMeso, lightDir), 0.0, 1.0));
  float nDoth = max(0.001, clamp(dot(nMeso, halfDir), 0.0, 1.0));

  // ---------- Fresnel（specular 与合成共用同一次计算即可） ----------
  float fresnel = FresnelSchlickRough(nMeso, viewDir, roughness, uRefractiveIndex);

  // ---------- specular ----------
  vec3 specular = cookTorranceSpecular(
    nMeso,
    nMacro,
    lightDir,
    viewDir,
    uLightRadiance,
    roughness,
    uRefractiveIndex,
    1.0 // shadow
  );

  // ---------- scattering ----------
  float var_H = max(0.0, vWaveHeight) * uHeightStrength;
  vec3 scattering = subsurfaceScattering(
    nMeso,
    lightDir,
    viewDir,
    var_H,
    uLightRadiance,
    uAmbientColor,
    1.0, // shadow
    uShadowIntensity,
    lightMask
  );

  // ---------- Optical Depth / Beer-Lambert 吸收（光程透射率）----------
  // baseDepth 是经验常数，代表"平均状态下光经过的水柱长度"（m），取 2~5 比较自然，对应"光大约穿过 2~5m 水才反射回来"
  float baseDepth = 3.0; // [m] 单位
  // 吸收系数 σ (1/m)，每个 RGB 通道独立（这一组对应"清澈深海"；浊水把 R 拉大、把 B 也拉一点）
  vec3 absorption = vec3(0.6, 0.15, 0.04); // R/G/B 各自的吸收率，单位 1/m
  vec3 transmittance = calcTransmittance(vDisplacementY, baseDepth, absorption);
  scattering *= transmittance;

  // ---------- environment reflect ----------
  // vec3 envReflect =
  //   uUseEnvironmentMap == 1
  //     ? textureCube(uEnvironmentMap, reflectDir).rgb * uEnvirLightStrength
  //     : mix(vec3(0.7, 0.85, 1.0), vec3(0.35, 0.55, 0.85), max(reflectDir.y, 0.0)) * uEnvirLightStrength;
  // vec3 envReflect = textureCube(uEnvironmentMap, reflectDir).rgb * uEnvirLightStrength;
  vec3 envReflect = calEnvReflect(nMeso, viewDir, reflectDir);

  // ---------- 光的叠加 ----------
  // vec3 color = (1.0 - fresnel) * scattering;
  vec3 color = (1.0 - fresnel) * scattering + specular;
  // vec3 color = (1.0 - fresnel) * scattering + specular + envReflect;
  // color = mix(color, uFoamColor, clamp(foam, 0.0, 1.0));

  color = color / (color + 1.0); // Reinhard tone mapping
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
  float alpha = 1.0;
  gl_FragColor = vec4(color, alpha);
  gl_FragColor = vec4(envReflect, alpha);
  // gl_FragColor = vec4(nMeso.xzy * 0.5 + 0.5, 1.0);
  // gl_FragColor = vec4(var_H, var_H, var_H, 1.0);
  // gl_FragColor = vec4(vec3(foam), 1.0);
  // gl_FragColor = vec4(vec3(surf.jacobian), 1.0);
}

// // 调试 1：单独看 Layer 3 的 slope 强度
// vec2 s3 = texture2DLodEXT(uGradientMap3, vWorldXZ * DISPLAY_TILE3, 0.0).rg;
// // gl_FragColor = vec4(abs(s3.x) * 5.0, abs(s3.y) * 5.0, 0.0, 1.0);

// // 调试 2：看 nMeso 在仅 Layer 2/3 时的 tilt 幅度
// vec2 slope23 =
//   texture2DLodEXT(uGradientMap2, vWorldXZ * DISPLAY_TILE2, 0.0).rg * uLayerContribute2 +
//   texture2DLodEXT(uGradientMap3, vWorldXZ * DISPLAY_TILE3, 0.0).rg * uLayerContribute3;
// float tilte = length(slope23);
// // gl_FragColor = vec4(vec3(tilte * 1.0), 1.0);

// // debug
// float h_abs = abs(vDisplacementY);
// float threshold = 3.0; // 先试 0.8
// // gl_FragColor = vec4(vec3(h_abs > threshold ? 1.0 : 0.0), 1.0);

// float h = vDisplacementY; // 可以带符号
// float sigma1 = threshold / 3.0;
// // fragment 末尾临时加
// // gl_FragColor = vec4(vec3(clamp(h * 0.2 + 0.5, 0.0, 1.0)), 1.0);

// if (h < -3.0 * sigma1)
//   color = vec3(0.0, 0.0, 0.2); // 极深谷（罕见）—— 深蓝黑
// else if (h < -2.0 * sigma1)
//   color = vec3(0.0, 0.1, 0.4); // 大波谷          —— 深蓝
// else if (h < -1.0 * sigma1)
//   color = vec3(0.1, 0.3, 0.6); // 普通波谷        —— 蓝
// else if (h < -0.3 * sigma1)
//   color = vec3(0.3, 0.6, 0.8); // 轻微下沉        —— 浅蓝
// else if (h < 0.3 * sigma1)
//   color = vec3(0.5, 0.8, 0.7); // 平面            —— 青绿
// else if (h < 1.0 * sigma1)
//   color = vec3(0.7, 0.9, 0.4); // 轻微隆起        —— 浅黄绿
// else if (h < 2.0 * sigma1)
//   color = vec3(1.0, 0.8, 0.2); // 普通波峰        —— 黄
// else if (h < 3.0 * sigma1)
//   color = vec3(1.0, 0.4, 0.1); // 大波峰          —— 橙
// else color = vec3(1.0, 1.0, 1.0); // 罕见巨浪顶      —— 白

// // gl_FragColor = vec4(color, 1.0);

// float tilt = degrees(acos(clamp(nMeso.y, 0.0, 1.0)));
// vec3 col;
// if (tilt < 5.0)
//   col = vec3(0.0, 0.2, 0.6); // 接近水平
// else if (tilt < 15.0) col = vec3(0.0, 0.6, 0.8);
// else if (tilt < 30.0) col = vec3(0.2, 1.0, 0.4);
// else if (tilt < 45.0) col = vec3(1.0, 1.0, 0.0);
// else if (tilt < 60.0) col = vec3(1.0, 0.5, 0.0);
// else col = vec3(1.0, 0.0, 0.0); // 接近垂直/翻转

// // gl_FragColor = vec4(col, 1.0);

