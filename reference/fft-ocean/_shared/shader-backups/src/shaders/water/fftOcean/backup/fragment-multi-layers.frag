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
// uniform int uUseDiffuseMap;
// uniform int uUseNormalMap;
uniform int uUseEnvironmentMap;

// ============================================================
// 4 基础贴图（按开关条件注入）
//   uDiffuseMap      — 备用，本 shader 未使用
//   uNormalMap       — 备用，法线由 FFT slope/jacobian 计算
//   uEnvironmentMap  — 立方体贴图，供 textureCube(reflect(-V,N)) 采样
//                     物理含义：环境辐射度 L_env(ω)，乘 Fresnel 参与最终输出
// ============================================================
// uniform sampler2D uDiffuseMap;
// uniform sampler2D uNormalMap;
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
//   uFoamColor — foam 颜色
//   Foam texture：颗粒/气泡的外观（由 Jacobian mask 决定 WHERE，由这张图决定 WHAT IT LOOKS LIKE）
//    uFoamMap     — RGB = 泡沫颗粒贴图，1024×1024 PBR foam color
//    uFoamUVScale — UV 缩放：值越大颗粒越细（屏幕上看到的颗粒尺度 = 1 / uFoamUVScale 米），经验值 0.1~0.5（颗粒物理尺度 2-10m）
// ============================================================
uniform sampler2D uFoamMap;
uniform float uFoamUVScale;
uniform vec3 uFoamColor;
// uniform float uFoamBias;
// uniform float uFoamPower;

// ============================================================
// 15 fog
// ============================================================
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogPower;

// ============================================================
// 16 远近衰减
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

// ---- ACES Filmic Tone Mapping (Narkowicz 2015 近似) ----
/**
 * 输入：HDR linear radiance ∈ [0, +∞)
 * 输出：[0, 1] sRGB-ready linear（仍需后续 pow(1/2.2) 才能送显示器）
 *
 * 数学：fit 自 ACES RRT+ODT，相对 Reinhard 的关键差别：
 *   - 暗部 (x<0.05)：ACES 输出 ≈ 0.5·x（压暗 50%），Reinhard 几乎不动
 *   - 中部 (x≈1)：ACES ≈ 0.8（vs Reinhard 0.5）
 *   - 亮部 (x>5)：ACES → ~1（vs Reinhard 0.83）
 * 物理含义：S 形曲线，模仿电影胶片的"暗中带细节、亮处不爆"
 */
vec3 ACESFilm(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp(x * (a * x + b) / (x * (c * x + d) + e), 0.0, 1.0);
}

// ==================== Sample: layer size method ====================
vec2 sampleLayerSlopeByLayerSize(sampler2D gradMap, float layerSize, float contribute) {
  vec2 uv = vSampleWorldXZ / layerSize;
  return texture2DLodEXT(gradMap, uv, 0.0).rg * contribute; // 强制 mip 0
}

float sampleLayerJacobianByLayerSize(sampler2D dispDerivMap, float layerSize, float contribute) {
  vec2 uv = vSampleWorldXZ / layerSize;
  return mix(1.0, texture2DLodEXT(dispDerivMap, uv, 0.0).a, contribute); // 强制 mip 0
}

// ==================== Normal & Slope & Jacobian ====================
// 原始平面上的点 (x, 0, z) 经过位移后变成: P(x,z) = (x + Dx(x,z),  Dy(x,z),  z + Dz(x,z))
// 要求法线，需要两个切向量: ∂P/∂x = (1 + ∂Dx/∂x, ∂Dy/∂x, ∂Dz/∂x) = (1 + dDx_dx, slope.x, dDz_dx) 和 ∂P/∂z = (∂Dx/∂z, ∂Dy/∂z, 1 + ∂Dz/∂z) = (dDx_dz, slope.y, 1 + dDz_dz)
struct SurfaceData {
  vec2 slope;
  vec3 normal;
  float jacobian;
};

SurfaceData calcSurfaceByLayerSize() {
  vec2 slope0 = sampleLayerSlopeByLayerSize(uGradientMap0, uLayerSize0, uLayerContribute0);
  vec2 slope1 = sampleLayerSlopeByLayerSize(uGradientMap1, uLayerSize1, uLayerContribute1);
  vec2 slope2 = sampleLayerSlopeByLayerSize(uGradientMap2, uLayerSize2, uLayerContribute2);
  vec2 slope3 = sampleLayerSlopeByLayerSize(uGradientMap3, uLayerSize3, uLayerContribute3);

  vec2 slopeAll = slope0 + slope1 + slope2 + slope3;
  vec2 slopeLow = slope0 + slope1;
  vec2 slopeHigh = slope2 + slope3;

  // ---- 距离淡入：近处 0、远处 1 ----
  float dist = length(uCameraPos.xz - vWorldPosition.xz); // 相机到 fragment 水平距离 [m]
  // 基准距离 500m
  // uVarMaskRange -- 远场强度倍数
  // uVarMaskPower -- 过渡曲线锐度
  //
  // invDepth 是"距离权重"：0 = 近、1 = 远
  //  ‐ dist / 500 把距离单位化到 [0, 1] 量级（500m 是经验基准）
  //  ‐ * uVarMaskRange 放大或缩小过渡发生的距离
  //      (Range 大 → 早开始过渡；Range 小 → 推迟过渡)
  //  ‐ pow(_, Power) 控制过渡形状
  //      (Power 大 → S 形锐利、近场扁、远场扁；Power 小 → 线性)
  float invDepth = clamp(pow(dist / 500.0 * uVarMaskRange, uVarMaskPower), 0.0, 1.0);
  invDepth = clamp(invDepth, 0.0, 1.0);

  // ---- 噪声源：用 layer-0 displacement.y 做空间随机 ----
  // 0.001 * uVarMaskTexScale 让斑点尺度落到几百米量级（参考的 uv/1000）
  float noiseRaw = texture2DLodEXT(uDisplacementMap0, vWorldXZ * 0.001 * uVarMaskTexScale, 0.0).y;
  // noise01 是"空间随机"：用 layer-0 displacement.y 当 hash 源
  //  ‐ 0.001 * uVarMaskTexScale 把采样 uv 拉到很大的尺度（让斑点尺度是百米量级）
  //  ‐ * 0.5 + 0.5：把 displacement.y 的有符号米级数值映射到 [0, 1]
  // 作用：让"远场切换"不是均匀地刷一片，而是带空间斑块感
  float noise01 = clamp(noiseRaw * 0.5 + 0.5, 0.0, 1.0);

  // ---- 二值化（参考里的 *4 + saturate）----
  // * 4.0 是把 noise01 拉到大部分 saturate 到 1，少部分留在 0
  // * invDepth 让斑块只在远场生效
  // 最终 varMask: 近场全 0、远场以斑块形式 0/1 切换
  float varMask = clamp(noise01 * 4.0 * invDepth, 0.0, 1.0);

  // NormalStrength 缩放
  vec2 finalSlope = mix(slopeAll, slopeHigh, varMask) * uNormalStrength;
  // vec2 finalSlope = slopeAll * uNormalStrength;

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
               * lightColor
               * (1.0 / (1.0 + lightMask))   // 光源端 masking
               * softShadow;

  scatter += k3 * uScatterColor * lightColor * softShadow;
  scatter += k4 * ambientColor;
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
float calcFoamMaskByLayerSize(float shadow) {
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
  SurfaceData surf;
  surf = calcSurfaceByLayerSize();

  // ---------- normal ----------
  vec3 nMacro = vec3(0.0, 1.0, 0.0);
  vec3 nMeso = surf.normal;
  nMeso = mix(nMacro, nMeso, pow(clamp(vClipDepth, 0.0, 1.0), uDisplaceDepthAttenuation));
  nMeso = normalize(uNormalMatrix * nMeso);

  // ---------- vectors / direction ----------
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);
  vec3 lightDir = normalize(uLightDir);
  vec3 halfDir = normalize(viewDir + lightDir);
  vec3 reflectDir = normalize(reflect(-viewDir, nMeso));

  // ---------- foam ----------
  // J=1 时平衡，J 越小越压缩 → foam 累积
  float shadow = 1.0;
  // float foam = calcFoam(surf.jacobian, shadow);
  float foamMask = calcFoamMaskByLayerSize(shadow);
  // foamMask = clamp(foamMask * 1.5, 0.0, 1.0);

  // ---------- roughness ----------
  // 物理含义：foam 是无数小气泡 + 破碎水沫，微表面取向高度无序 → 等效 roughness 大
  //   foamMask = 0 → roughness = uRoughness（平静水的镜面感）
  //   foamMask = 1 → roughness = uRoughness + uFoamRoughness（完全 foam，几乎无镜面）
  // 用 foamMask（已 ×1.5 提强度后）当权重，保证 roughness 调制和颜色 mix 用同一份 foam 浓度
  // float roughness = uRoughness;
  float roughness = uRoughness + foamMask * uFoamRoughness;

  // ---------- mask ----------
  // 复用 Λ(l)，给 SSS 使用
  float lightMask = SmithMaskBeckmann(halfDir, lightDir, roughness);
  float viewMask = SmithMaskBeckmann(halfDir, viewDir, roughness);
  float geometryMask = 1.0 / (1.0 + viewMask + lightMask);

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
  // 把 subsurfaceScattering 的 ambientColor 入参改成动态查询
  vec3 ambientColor = textureCubeLodEXT(uPrefilteredEnvMap, nMeso, uMaxReflectionLod).rgb;
  vec3 scattering = subsurfaceScattering(
    nMeso,
    lightDir,
    viewDir,
    var_H,
    uLightRadiance,
    // uAmbientColor,
    ambientColor,
    1.0, // shadow
    uShadowIntensity,
    lightMask
  );

  // ---------- environment reflect ----------
  // vec3 envReflect =
  //   uUseEnvironmentMap == 1
  //     ? textureCube(uEnvironmentMap, reflectDir).rgb * uEnvirLightStrength
  //     : mix(vec3(0.7, 0.85, 1.0), vec3(0.35, 0.55, 0.85), max(reflectDir.y, 0.0)) * uEnvirLightStrength;
  // vec3 envReflect = textureCube(uEnvironmentMap, reflectDir).rgb * uEnvirLightStrength;
  vec3 envReflect = calEnvReflect(nMeso, viewDir, reflectDir);

  // ---------- foam ----------
  // 用泡沫贴图给 mask 上"颗粒感"
  vec2 foamUV = vWorldXZ * uFoamUVScale; // 让 UV 在世界空间稳定（不随相机/网格 LOD 漂移）
  vec3 foamAlbedo = texture2D(uFoamMap, foamUV).rgb;
  // Lambert
  float NdotL = max(0.0, dot(nMeso, lightDir));
  // vec3 foamLit = foamAlbedo * (uLightRadiance * NdotL + uAmbientColor);
  // half-Lambert：把 dot(N,L) 从 [-1,1] 拉到 [0,1]，背光侧也保留 50% 亮度
  float halfL = dot(nMeso, lightDir) * 0.5 + 0.5;
  // vec3 foamLit = foamAlbedo * (uLightRadiance * halfL + uAmbientColor);
  // IBL ambient
  vec3 foamIBL = textureCubeLodEXT(uPrefilteredEnvMap, nMeso, uMaxReflectionLod).rgb;
  vec3 foamLit = foamAlbedo * uFoamColor * (uLightRadiance * NdotL + foamIBL);

  // ---- Atmospheric perspective(fog)  ----
  // 物理含义：光从远处水面传到相机，要穿过 d 米空气，每 m 损失一点能量并混入大气底色
  //   color_final = mix(color, fogColor, 1 - exp(-d / falloff))
  //   falloff 越小越雾，越大越透
  //   fogColor 用 horizon 那条颜色（你 sky 是浅灰偏蓝，可以选 vec3(0.7, 0.78, 0.85)）
  float dist = length(uCameraPos - vWorldPosition); // 米
  float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, uFogPower));
  vec3 fogColor = vec3(0.7, 0.78, 0.85); // 接近你 sky 的 horizon 灰蓝

  // ---------- 光的叠加 ----------
  // color = (1.0 - fresnel) * scattering + envReflect;
  vec3 color = (1.0 - fresnel) * scattering + specular + envReflect;

  // foam
  color = mix(color, foamLit, foamMask);

  // fog
  // color = mix(color, uFogColor, fogFactor);

  // ---------- HDR → SDR tone mapping ----------
  // 曝光下推：让 ACES 工作在略欠曝区间，保 shadow 深、保 highlight 不爆
  // 经验值 0.55 ~ 0.7。值越小整体越暗。
  const float exposure = 0.8;
  color *= exposure;

  // ACES filmic（S 形，shadow 压暗、highlight 自然 roll-off），替换 Reinhard：后者在 shadow 区斜率 ≈ 1 → 浪体灰
  // color = color / (color + 1.0); // Reinhard tone mapping
  color = ACESFilm(color);

  // sRGB gamma 编码（必须做，否则显示器二次解码导致整体压暗）
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

  // ---------- 最终输出 ----------
  float alpha = 1.0;
  gl_FragColor = vec4(color, alpha);

  // ---------- debug 输出 ----------
  // gl_FragColor = vec4(nMeso.xzy * 0.5 + 0.5, 1.0);
  // gl_FragColor = vec4(scattering, 1.0);
  // gl_FragColor = vec4(specular, 1.0);
  // gl_FragColor = vec4(envReflect, 1.0);
  // gl_FragColor = vec4(vec3(foamMask), 1.0);
  // gl_FragColor = vec4(vec3(foamLit), 1.0);
  // gl_FragColor = vec4(vec3(1.0 - fresnel), 1.0);
  // gl_FragColor = vec4(vec3(surf.jacobian), 1.0);

}
