// FFTOceanFragment.frag (Backup)
// ============================= Backup1(old) =============================
#ifdef GL_ES
precision highp float;
#endif

// 从 Vertex shader 传入的 Fragment varying
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying float vFoam; // 传递泡沫因子（雅可比值）
varying float vWaterDepth;
varying float vWaveHeight;

uniform vec3 uCameraPos;
// 光照参数
uniform vec3 uLightColor;
uniform vec3 uLightPos;
uniform vec3 uLightDir;

// 水体颜色参数
uniform vec3 uWaterColor;
uniform vec3 uDeepWaterColor;
uniform vec3 uShallowWaterColor;

// 水体物理参数
uniform float uTransparency;
uniform float uReflectance;
uniform float uRefractiveIndex;
uniform float uFresnelPower;
uniform float uSpecularPower;
uniform float uSpecularStrength;
uniform float uFoamThreshold;

// 波浪控制参数
uniform float uTime;

// Textures
uniform sampler2D uDiffuseMap;
uniform sampler2D uNormalMap;
uniform samplerCube uEnvironmentMap;
uniform int uUseDiffuseMap;
uniform int uUseNormalMap;
uniform int uUseEnvironmentMap;

uniform sampler2D uDisplacementMap;

// 材质属性修正：水的真实物理参数
const float WATER_IOR = 1.33; // 水的折射率
const float AIR_IOR = 1.0; // 空气折射率
const float WATER_METALLIC = 0.02; // 水的金属度（几乎为非金属）
const float WATER_BASE_ROUGHNESS = 0.008; // 水的基础粗糙度（非常光滑）
const vec3 WATER_F0 = vec3(0.02); // 水的基础反射率

// 深度和颜色参数
const float DEPTH_ATTENUATION = 0.05; // 深度衰减系数
const float FOAM_THRESHOLD = 0.4; // 泡沫阈值

// Constant
#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307
#define INV_PI 0.31830988618
#define INV_TWO_PI 0.15915494309

// ====================== 以下：Cook-Torrance 模型 ======================
// 头部声明
vec3 fresnelSchlick(float cosTheta, vec3 F0, float fresnelPower);
float distributionGGX(vec3 normal, vec3 halfwayVector, float roughness);
float GeometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness);

/**
 * === Cook-Torrance 模型 -- 基于渲染方程的 PBR 模型 ===
 *
 * 基于物理的渲染方程实现:
 *
 *  Lo(p,ωo) = ∫Ω (kd*c/π + ks*DFG/[4(ωo·n)(ωi·n)]) * Li(p,ωi) * (n·ωi) dωi
 *  变量说明:
 *   - kd/ks: 漫反射/镜面反射系数
 *   - c: albedo颜色 (RGB)
 *   - n: 单位法向量
 *   - ωi: 入射方向向量 (单位向量)
 *   - ωo: 出射方向向量 (单位向量)
 *   - Li: 入射光强度
 */
vec3 CookTorranceRadiance(
  vec3 albedo,
  float metallic,
  float roughness,
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  vec3 inputRadiance,
  float fresnelPower
) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);

  vec3 halfwayVector = normalize(viewDir + lightDir);
  float cosTheta = max(dot(normal, lightDir), 0.0);

  float D = distributionGGX(normal, halfwayVector, roughness);
  vec3 F = fresnelSchlick(cosTheta, F0, fresnelPower);
  float G = GeometrySmith(normal, viewDir, lightDir, roughness);

  // specular
  vec3 nominator = D * G * F;
  float denominator = 4.0 * max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0) + 0.001;
  vec3 specular = nominator / denominator;

  // diffuse
  vec3 ks = F;
  vec3 kd = (1.0 - metallic) * (vec3(1.0) - ks) * 0.015; // 极小的漫反射系数
  vec3 diffuse = kd * albedo / M_PI;

  float NdotL = max(dot(normal, lightDir), 0.0);

  return (diffuse + specular) * inputRadiance * NdotL;
}

/**
 * ===  Cook-Torrance diffuse BRDF 项 ===
 *
 * kd * c / π
 */
vec3 CookTorranceDiffuseBRDF(
  vec3 albedo,
  float metallic,
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float fresnelPower
) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);
  float cosTheta = max(dot(normal, lightDir), 0.0);

  vec3 F = fresnelSchlick(cosTheta, F0, fresnelPower);
  vec3 ks = F;
  vec3 kd = (1.0 - metallic) * (vec3(1.0) - ks);
  // diffuse
  vec3 diffuse = kd * albedo / M_PI;

  return diffuse;
}

/**
 * === Cook-Torrance specular BRDF项 ===
 *
 *  DFG / [4(ωo·n)(ωi·n)]
 *
 *   - DFG: 微表面模型的三个核心函数乘积
 *     * D (Normal Distribution Function): 微表面法线分布函数（例：GGX）
 *     * F (Fresnel Equation): 菲涅尔反射率（例：Schlick近似）
 *     * G (Geometry Function): 几何遮蔽函数（例：Smith模型）
 *   - ωo·n: 观察方向与法线的点积（cosθo，θo为观察角）
 *   - ωi·n: 入射方向与法线的点积（cosθi，θi为入射角）
 *   - 分母4(ωo·n)(ωi·n): 能量守恒校正因子，补偿微表面模型的双重几何衰减
 *
 *  典型实现参考（以GGX为例）:
 *
 *    - D(n,h,α) = α² / [π((n·h)²(α²−1)+1)²]  // h为半角向量
 *    - F(v,h,f0) = f0 + (1−f0)(1−(v·h))⁵     // f0为基础反射率
 *    - G(l,v,n,α) = G1(l) * G1(v)            // 分离遮蔽阴影
 *    G1(v) = (n·v) / [(n·v)(1−k)+k]           // k = α/2
 */
vec3 CookTorranceSpecularBRDF(
  vec3 albedo,
  float roughness,
  float metallic,
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float fresnelPower
) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);
  float cosTheta = max(dot(normal, lightDir), 0.0);
  vec3 halfwayVector = normalize(viewDir + lightDir);

  vec3 F = fresnelSchlick(cosTheta, F0, fresnelPower);
  float D = distributionGGX(normal, halfwayVector, roughness);
  float G = GeometrySmith(normal, viewDir, lightDir, roughness);

  // specular
  vec3 nominator = D * G * F;
  float denominator = 4.0 * max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0) + 0.001;
  vec3 specular = nominator / denominator;

  return specular;
}

/**
 * === F (Fresnel Equation): 菲涅尔反射率 ===
 *
 *  F(v,h,F0) = F0 + (1−F0)(1−(v·h))⁵
 *
 *   - v​​：观察方向向量（从表面指向相机）
 *   - h​​：半程向量 Halfway Vector
 *
 * 首先我们想计算的是镜面反射和漫反射之间的比值，或者说与表面折射的光线相比，它反射了多少光线。
 * Fresnel-Schlick近似法接收一个参数F0，被称为0°入射角的反射率，或者说是直接(垂直)观察表面时有多少光线会被反射。
 * 这个参数F0会因为材料不同而不同，而且对于金属材质会带有颜色。在PBR金属流中我们简单地认为大多数的绝缘体在F0为0.04的时候看起来视觉上是正确的，对于金属表面我们根据反射率特别地指定F0。
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0, float fresnelPower) {
  // return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); // clamp 是防御式编程，避免 cosTheta 精度问题使得 1.0 - cosTheta < 0.0 从而带来的黑点
  // return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), fresnelPower);

  // 计算垂直入射时的反射率
  F0 = vec3(pow((AIR_IOR - WATER_IOR) / (AIR_IOR + WATER_IOR), 2.0));
  // Schlick近似的菲涅尔公式
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
/**
 * 考虑粗糙度的菲涅尔（用于环境光）
 * 参考：Sébastien Lagarde的改进公式
 */
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
/**
 * === D (Normal Distribution Function): 微表面法线分布函数 ===
 *
 *  α² / [π((n·h)²(α²−1)+1)²]
 *
 *   - ​​α​​：粗糙度参数（Roughness），取值范围 [0,1]，通常由粗糙度贴图采样得到。低粗糙度（α→0）法线集中，形成锐利高光；高粗糙度（α→1）法线分散，形成模糊高光。α = Roughness²，平方操作增强粗糙度的非线性效果
 *   - α²​​：粗糙度的平方，用于控制微表面法线分布的集中程度。
 *   - n​​：表面宏观法线向量。
 *   - h​​：半程向量 Halfway Vector
 */
float distributionGGX(vec3 normal, vec3 halfwayVector, float roughness) {
  float alpha = roughness * roughness;
  float alpha2 = alpha * alpha;
  float NdotH = dot(normal, halfwayVector);
  float NdotH2 = NdotH * NdotH;

  float numerator = alpha2;
  float denominator = NdotH2 * (alpha2 - 1.0) + 1.0;
  denominator = M_PI * denominator * denominator;

  return numerator / denominator;
}

/**
 * === G (Geometry Function): 几何遮蔽函数 ===
 *
 * G(l,v,n,α) = G1(l) * G1(v)   // 分离遮蔽阴影
 *
 *   - G1(v) = (n·v) / [(n·v)(1−k)+k]   // k = α/2
 */
float GeometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = r * r / 8.0;

  float numerator = NdotV;
  float denominator = NdotV * (1.0 - k) + k;

  return numerator / denominator;
}
float GeometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness) {
  float NdotV = max(dot(normal, viewDir), 0.0);
  float NdotL = max(dot(normal, lightDir), 0.0);
  float ggx2 = GeometrySchlickGGX(NdotV, roughness);
  float ggx1 = GeometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}
// ====================== 以上：Cook-Torrance 模型 ======================

// ====================== 以下：水体颜色 ======================
/**
 * === 水体特效：深度颜色混合 ===
 *
 * 模拟光在水中的指数衰减：
 * I(d) = I₀ × e^(-αd)
 *
 * 其中：
 * - d = 深度
 * - α = 衰减系数（不同波长的光衰减率不同）
 */
vec3 calculateDepthColor(vec3 baseColor, float depth) {
  vec3 shallowColor = uShallowWaterColor;
  vec3 deepColor = uDeepWaterColor;

  // 指数衰减模拟光在水中的传播
  // DEPTH_ATTENUATION 越大，exp(-depth * DEPTH_ATTENUATION) 越小，depthFactor 越大
  float depthFactor = 1.0 - exp(-depth * DEPTH_ATTENUATION);

  // depthFactor 越大，deepColor 占比越多
  // DEPTH_ATTENUATION 越大，deepColor 占比越多
  return mix(shallowColor, deepColor, depthFactor);
}
/**
 * 增强的深度颜色计算
 */
vec3 calculateEnhancedDepthColor(vec3 baseColor, float depth, vec2 worldPos, float time) {
  // 基础深度颜色
  vec3 shallowColor = uShallowWaterColor;
  vec3 deepColor = uDeepWaterColor;

  float depthFactor = 1.0 - exp(-depth * DEPTH_ATTENUATION);
  vec3 depthColor = mix(shallowColor, deepColor, depthFactor);

  // 添加水藻和底部反射的变化
  vec2 algaeUV = worldPos * 0.05 + time * 0.02;
  float algaePattern = sin(algaeUV.x * 10.0) * cos(algaeUV.y * 8.0) * 0.5 + 0.5;
  algaePattern = smoothstep(0.3, 0.7, algaePattern);

  vec3 algaeColor = vec3(0.2, 0.5, 0.3);
  depthColor = mix(depthColor, algaeColor, algaePattern * 0.2 * (1.0 - depthFactor));

  return depthColor;
}

// 颜色深度衰减，模拟不同波长光在水中的不同衰减率
vec3 applyWaterColorAttenuation(vec3 color, float depth) {
  // 红、绿、蓝光的衰减系数（红光衰减最快）
  vec3 attenuationCoeff = vec3(0.3, 0.1, 0.05);

  // 应用指数衰减
  vec3 attenuation = exp(-attenuationCoeff * depth);

  return color * attenuation;
}
// ====================== 以上：水体颜色 ======================

// ====================== 以下：水体透明度 ======================
/**
 * === 透明度 ===
 *
 * 水体的透明度受多个因素影响：
 * 1. 深度：深水区更不透明
 * 2. 泡沫：泡沫区域完全不透明
 * 3. 角度：掠射角时反射增强，透明度降低
 */
// 基于深度的透明度计算
float calculateDepthTransparency(float depth, vec3 attenuationCoeff) {
  // RGB通道的不同衰减率（蓝光衰减最慢）
  vec3 attenuation = exp(-attenuationCoeff * depth);

  // 综合透明度（考虑视觉感知）
  float transparency = dot(attenuation, vec3(0.299, 0.587, 0.114));

  return clamp(transparency, 0.0, 1.0);
}
float calculateWaterAlpha(float foam, float depth, float NdotV) {
  // === 基础透明度（基于深度）===
  float baseAlpha = mix(0.8, 0.95, clamp(depth * 0.08, 0.0, 1.0));

  // === 菲涅尔透明度调制 ===
  // 掠射角时水体更不透明（更多反射）
  float fresnelAlpha = mix(0.1, 0.0, pow(1.0 - NdotV, 3.0));

  // === 泡沫区域不透明 ===
  float finalAlpha = mix(baseAlpha + fresnelAlpha, 1.0, foam);

  return clamp(finalAlpha, 0.0, 1.0);
}
// ====================== 以上：水体透明度 ======================

// ====================== 以下：折射计算   ======================
/**
 * === 简化的折射偏移 ===
 *
 * 计算水面折射引起的视觉偏移
 * 这里使用简化的近似，实际应用中可以用屏幕空间折射
 */
vec2 calculateRefractionOffset(vec3 normal, vec3 viewDir, float strength) {
  // 基于法线和视角的简化折射偏移
  vec2 offset = normal.xz * strength;

  // 根据视角调制偏移强度
  float NdotV = max(dot(normal, viewDir), 0.0);
  // offset *= 1.0 - NdotV * 0.5;
  float fresnelTerm = pow(1.0 - NdotV, 2.0);

  // 折射在掠射角时减弱（更多反射）
  offset *= 1.0 - fresnelTerm * 0.8;

  return offset;
}
/**
 * 计算折射向量
 * @param incident 入射方向向量（指向表面）
 * @param normal 表面法向量
 * @param eta 相对折射率 (n1/n2)
 * @return 折射方向向量，如果全内反射则返回零向量
 */
vec3 calculateRefraction(vec3 incident, vec3 normal, float eta) {
  float cosI = -dot(normal, incident);
  float sinT2 = eta * eta * (1.0 - cosI * cosI);

  // 检查全内反射
  if (sinT2 > 1.0) {
    return vec3(0.0); // 全内反射
  }

  float cosT = sqrt(1.0 - sinT2);
  return eta * incident + (eta * cosI - cosT) * normal;
}
/**
 * 计算折射颜色（简化的屏幕空间方法）
 */
vec3 calculateRefractedColor(
  vec2 screenCoord,
  vec3 normal,
  vec3 viewDir,
  sampler2D sceneTexture,
  float refractionStrength
) {
  // 计算折射偏移
  vec2 refractionOffset = calculateRefractionOffset(normal, viewDir, refractionStrength);

  // 采样折射后的场景颜色
  vec2 refractionCoord = screenCoord + refractionOffset;
  refractionCoord = clamp(refractionCoord, 0.0, 1.0);

  vec3 refractedColor = texture2D(sceneTexture, refractionCoord).rgb;

  // 应用水体颜色调制
  vec3 waterTint = vec3(0.8, 0.9, 1.0);
  return refractedColor * waterTint;
}
// ====================== 以上：折射计算   ======================

// ====================== 以下：次表面散射   ======================
/**
 * 计算次表面散射
 */
vec3 calculateSubsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 thickness, vec3 scatterColor) {
  vec3 lightDirWS = lightDir + normal * 0.25;
  float VdotL = pow(clamp(dot(viewDir, -lightDirWS), 0.0, 1.0), 4.0);
  return scatterColor * VdotL * thickness;
}
/**
 * 透光性次表面散射近似
 */
vec3 calculateTranslucency(vec3 normal, vec3 lightDir, vec3 viewDir, vec3 thickness, vec3 scatterColor, float power) {
  // 计算透射光方向
  vec3 lightDirWS = lightDir + normal * 0.25;

  // 视线与透射光的夹角
  float VdotL = pow(clamp(dot(viewDir, -lightDirWS), 0.0, 1.0), power);

  // 厚度调制
  float distortion = 0.1;
  vec3 H = normalize(lightDir + normal * distortion);
  float VdotH = pow(clamp(dot(viewDir, -H), 0.0, 1.0), power);

  // 组合透光效果
  return scatterColor * (VdotL + VdotH) * thickness;
}
/**
 * 基于深度的次表面散射
 */
vec3 calculateDepthBasedSSS(vec3 worldPos, vec3 normal, vec3 lightDir, vec3 viewDir, float depth) {
  // 散射颜色（偏向蓝绿色）
  vec3 scatterColor = vec3(0.2, 0.6, 0.8);

  // 深度相关的散射强度
  float scatterStrength = exp(-depth * 0.15);

  // 计算散射方向
  vec3 scatterDir = normalize(lightDir + normal * 0.3);
  float scatterDot = pow(clamp(dot(viewDir, -scatterDir), 0.0, 1.0), 3.0);

  // 基于法线的侧向散射
  float sideLighting = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), 2.0);

  return scatterColor * (scatterDot + sideLighting * 0.5) * scatterStrength;
}

/**
 * 水体散射颜色的物理计算
 */
vec3 calculatePhysicalScatterColor(float depth, float turbidity, vec3 lightColor) {
  // === 水分子的Rayleigh散射 ===
  // 蓝光散射最强，红光散射最弱（∝ 1/λ⁴）
  vec3 rayleighCoeff = vec3(
    0.1, // 红光 (700nm)
    0.3, // 绿光 (550nm)
    0.8 // 蓝光 (450nm)
  );

  // === 悬浮颗粒的Mie散射 ===
  // 对所有波长影响相近
  float mieCoeff = turbidity * 0.5;
  vec3 mieScatter = vec3(mieCoeff);

  // === 叶绿素吸收 ===
  // 主要吸收红光和蓝光，透射绿光
  vec3 chlorophyllAbsorption = vec3(0.7, 0.2, 0.6) * turbidity;

  // === 综合散射颜色 ===
  vec3 totalScattering = rayleighCoeff + mieScatter - chlorophyllAbsorption;

  // 深度衰减
  vec3 depthAttenuation = exp(-totalScattering * depth * 0.1);

  // 与入射光颜色结合
  return lightColor * totalScattering * depthAttenuation;
}

/**
 * 不同水体类型的散射颜色
 */
vec3 getWaterTypeScatterColor(int waterType, float depth) {
  vec3 scatterColor;

  if (waterType == 0) {
    scatterColor = vec3(0.05, 0.3, 0.8);
  } else if (waterType == 1) {
    scatterColor = vec3(0.1, 0.5, 0.9);
  } else if (waterType == 2) {
    scatterColor = vec3(0.15, 0.4, 0.6);
  } else if (waterType == 3) {
    scatterColor = vec3(0.3, 0.4, 0.4);
  } else if (waterType == 4) {
    scatterColor = vec3(0.2, 0.3, 0.2);
  } else {
    scatterColor = vec3(0.1, 0.4, 0.7); // 默认蓝色
  }

  // 深度调制
  float depthFactor = clamp(depth * 0.05, 0.0, 1.0);
  return mix(scatterColor * 1.2, scatterColor * 0.6, depthFactor);
}
/**
 * 基于物理的次表面散射
 */
vec3 calculatePhysicalSSS(
  vec3 worldPos,
  vec3 normal,
  vec3 lightDir,
  vec3 viewDir,
  float waterDepth,
  vec3 lightColor,
  int waterType
) {
  // === 1. 计算散射颜色 ===
  vec3 scatterColor = getWaterTypeScatterColor(waterType, waterDepth);

  // 如果有环境参数，可以进一步调制
  // scatterColor = calculatePhysicalScatterColor(waterDepth, uTurbidity, lightColor);

  // === 2. 计算厚度 ===
  // 基于深度和角度的厚度估算
  float NdotV = max(dot(normal, viewDir), 0.0);
  float apparentThickness = waterDepth / (NdotV + 0.1); // 避免除零
  vec3 thickness = vec3(exp(-apparentThickness * 0.08));

  // === 3. 多种散射效果组合 ===

  // 直接光散射
  vec3 directSSS = calculateTranslucency(normal, lightDir, viewDir, thickness, scatterColor, 4.0);

  // 环境光散射
  vec3 ambientScatterColor = scatterColor * 0.5;
  vec3 ambientSSS = calculateDepthBasedSSS(worldPos, normal, lightDir, viewDir, waterDepth) * ambientScatterColor;

  // 侧向散射（边缘光效应）
  float rimLighting = pow(1.0 - NdotV, 2.0);
  vec3 rimSSS = scatterColor * rimLighting * thickness * 0.3;

  // === 4. 时间动态变化 ===
  float timeVariation = sin(uTime * 0.3 + worldPos.x * 0.05) * 0.1 + 0.9;

  return (directSSS + ambientSSS + rimSSS) * timeVariation;
}

/**
 * 针对不同光源的散射计算
 */
vec3 calculateMultiLightSSS(vec3 worldPos, vec3 normal, vec3 viewDir, float waterDepth) {
  vec3 totalSSS = vec3(0.0);

  // === 主光源散射（太阳光）===
  // if (uLightColor.r > 0.0 || uLightColor.g > 0.0 || uLightColor.b > 0.0) {
  //   vec3 sunSSS = calculatePhysicalSSS(
  //     worldPos,
  //     normal,
  //     uLightDir,
  //     viewDir,
  //     waterDepth,
  //     uLightColor,
  //     0 // 假设是海水
  //   );
  //   totalSSS += sunSSS;
  // }

  // === 环境光散射（天空光）===
  vec3 reflectDir = reflect(-viewDir, normal);
  // vec3 skyColor = vec3(0.4, 0.6, 0.9); // 可以从skybox采样
  vec3 skyColor = textureCube(uEnvironmentMap, reflectDir).rgb;
  vec3 skySSS =
    calculatePhysicalSSS(worldPos, normal, vec3(0.0, 1.0, 0.0), viewDir, waterDepth, skyColor * 0.3, 0) * 0.5;
  totalSSS += skySSS;

  // === 底部反射光散射 ===
  if (waterDepth < 5.0) {
    // 只在浅水区考虑
    vec3 bottomColor = vec3(0.8, 0.7, 0.5); // 沙底颜色
    vec3 bottomSSS =
      calculatePhysicalSSS(worldPos, normal, vec3(0.0, -1.0, 0.0), viewDir, waterDepth, bottomColor * 0.2, 0) *
      (1.0 - waterDepth * 0.2);
    totalSSS += bottomSSS;
  }

  return totalSSS;
}
// ====================== 以上：次表面散射   ======================

// ====================== 以下：直接光照计算   ======================
// 计算直接光照的 Diffuse 部分
vec3 calculateDirectDiffuse(
  vec3 albedo,
  float metallic,
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float fresnelPower,
  vec3 thickness,
  vec3 scatterColor
) {
  vec3 baseDiffuse = CookTorranceDiffuseBRDF(albedo, metallic, normal, viewDir, lightDir, fresnelPower);
  vec3 subsurface = calculateSubsurfaceScattering(lightDir, viewDir, normal, thickness, scatterColor);

  vec3 directDiffuse = baseDiffuse + subsurface;

  return directDiffuse;
}
// ====================== 以上：直接光照计算   ======================

// ====================== 以下：环境光计算 ======================
/**
 * 环境光采样
 */
vec3 sampleEnvironment(vec3 reflectDir) {
  vec3 envReflect = textureCube(uEnvironmentMap, reflectDir).rgb;
  envReflect = pow(envReflect, vec3(1.0 / 2.2));
  return envReflect;
}
vec3 sampleEnvironment(vec3 reflectDir, float roughness) {
  // 根据粗糙度选择mipmap level
  float mipLevel = roughness * 8.0; // 假设8级mipmap
  return textureCube(uEnvironmentMap, reflectDir, mipLevel).rgb;
}

/**
 * 计算环境光 Diffuse 部分
 */
vec3 calculateEnvDiffuse(vec3 albedo, vec3 normal, vec3 lightDir, vec3 viewDir, float depth, float metallic) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);
  float NdotV = max(dot(normal, viewDir), 0.0);
  vec3 F = fresnelSchlick(NdotV, F0, 5.0);
  vec3 kd = (vec3(1.0) - F) * (1.0 - metallic);

  vec3 radiance = vec3(0.0, 0.0, 0.0);

  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = normalize(cross(normal, right));

  // 不能直接用 phi += 0.25 和 theta += 0.25，会报错：Loop index cannot be modified by non-constant expression
  // float delta = 0.5;
  float sampleCounts = 0.0;
  // Σᵢ Σⱼ f(θᵢ,φⱼ) sin(θᵢ) × Δθ × Δφ, Δθ = π/(2×n2), Δφ = 2π/n1
  //  = Σᵢⱼ f(θᵢ,φⱼ) sin(θᵢ) × (π/2n2) × (2π/n1)
  //  = (π²/n1n2) × Σᵢⱼ f(θᵢ,φⱼ) sin(θᵢ)
  //  = (π²/sampleCounts) × Σᵢⱼ f(θᵢ,φⱼ) sin(θᵢ)
  for (float phi = 0.0; phi < 2.0 * M_PI; phi += 1.0) {
    for (float theta = 0.0; theta < M_PI / 2.0; theta += 1.0) {
      // 球坐标 -> 笛卡尔坐标（正切空间）
      // z 轴向上，θ 是与 z 轴的夹角，φ 是与 x 轴的夹角
      vec3 tangentSample = vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
      // 正切空间 -> 世界坐标  基变换：从"标准坐标系"到"世界坐标系"
      // localSample.x * right：局部X轴方向的贡献
      // localSample.y * up：   局部Y轴方向的贡献
      // localSample.z * normal：局部Z轴方向的贡献
      vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal;

      radiance += textureCube(uEnvironmentMap, sampleVec).rgb * cos(theta) * sin(theta);

      sampleCounts++;
    }
  }

  // sampleCounts = n1 * n2
  radiance = M_PI * M_PI * radiance * (1.0 / sampleCounts);

  vec3 envDiffuse = kd * albedo / M_PI * radiance;

  return envDiffuse * 0.3;
}

/**
 * 计算环境光 Specular 部分
 */
vec3 calculateEnvSpecular(vec3 albedo, vec3 normal, vec3 viewDir, float reflectance, float metallic, float roughness) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);
  float NdotV = max(dot(normal, viewDir), 0.0);
  vec3 reflectDir = reflect(-viewDir, normal);

  vec3 envColor = sampleEnvironment(reflectDir, roughness);
  // vec3 envFresnel = fresnelSchlick(NdotV, F0, 5.0);
  vec3 envFresnel = fresnelSchlickRoughness(NdotV, F0, roughness);
  vec3 envSpecular = envColor * envFresnel * reflectance;

  return envSpecular;
}
// ====================== 以上：环境光计算 ======================

// ====================== 以下：法线计算 ======================
vec3 generateDetailWaterNormal(vec2 worldPos, float time, float detailScale, float detailStrength) {
  // 高频细节噪声（模拟风吹产生的小波纹）
  vec2 detailUV1 = worldPos * detailScale + time * vec2(0.05, 0.08);
  vec2 detailUV2 = worldPos * detailScale * 2.1 + time * vec2(-0.07, 0.06);

  // 使用更细致的噪声函数
  float detail1 = sin(detailUV1.x * 25.0) * cos(detailUV1.y * 20.0) * 0.4;
  float detail2 = cos(detailUV2.x * 35.0) * sin(detailUV2.y * 30.0) * 0.3;
  float detail3 = sin((detailUV1.x + detailUV1.y) * 40.0) * 0.3;

  float totalDetail = detail1 + detail2 + detail3;

  // 计算细节法线的梯度
  float epsilon = 0.001;
  float dDetailDx =
    totalDetail -
    (sin((detailUV1.x + epsilon) * 25.0) * cos(detailUV1.y * 20.0) * 0.4 +
      cos((detailUV2.x + epsilon) * 35.0) * sin(detailUV2.y * 30.0) * 0.3 +
      sin((detailUV1.x + epsilon + detailUV1.y) * 40.0) * 0.3);

  float dDetailDy =
    totalDetail -
    (sin(detailUV1.x * 25.0) * cos((detailUV1.y + epsilon) * 20.0) * 0.4 +
      cos(detailUV2.x * 35.0) * sin((detailUV2.y + epsilon) * 30.0) * 0.3 +
      sin((detailUV1.x + (detailUV1.y + epsilon)) * 40.0) * 0.3);

  // 构造切线空间的细节法线
  return normalize(vec3(-dDetailDx * detailStrength, 1.0, -dDetailDy * detailStrength));
}
/**
 * 法线混合方法（考虑物理正确性）
 */
vec3 blendGerstnerWithDetail(vec3 gerstnerNormal, vec3 detailNormal, float detailWeight) {
  // 方法1：Reoriented Normal Mapping（推荐）
  vec3 t = gerstnerNormal * vec3(2.0, 2.0, 2.0) + vec3(-1.0, -1.0, 0.0);
  vec3 u = detailNormal * vec3(-2.0, -2.0, 2.0) + vec3(1.0, 1.0, -1.0);
  vec3 blended = t * dot(t, u) / t.z - u;

  return normalize(mix(gerstnerNormal, blended, detailWeight));
}
/**
 * 完整的水面法线计算流程
 */
vec3 calculateCompleteWaterNormal(vec3 normal, vec2 worldPos, float time) {
  // 主法线
  vec3 mainNormal = normal;

  // 生成细节法线
  vec3 detailNormal = generateDetailWaterNormal(worldPos, time, 0.1, 0.2);

  // 混合主法线和细节法线
  vec3 finalNormal = blendGerstnerWithDetail(mainNormal, detailNormal, 0.3);

  return finalNormal;
}
// ====================== 以上：法线计算 ======================

// ====================== 以下：泡沫计算 ======================
/**
 * === 物理正确的泡沫计算 ===
 *
 * 泡沫生成的物理条件：
 * 1. 波浪陡峭度过高（雅可比行列式 < 阈值）
 * 2. 波峰处的速度梯度大
 * 3. 气泡夹带和破碎波
 */
/**
 * 基于波浪陡峭度的泡沫计算
 */
float calculateSteepnessFoam(vec3 normal, float steepnessThreshold) {
  // 法线偏离垂直方向的程度
  float steepness = 1.0 - normal.y;

  // 非线性映射，突出陡峭区域
  steepness = pow(steepness, 2.0);

  // 阈值化处理
  return smoothstep(steepnessThreshold, steepnessThreshold + 0.2, steepness);
}
/**
 * 基于雅可比行列式的泡沫
 */
float calculateJacobianFoam(vec2 position, float time, float jacobian) {
  // 当雅可比行列式接近或小于0时产生泡沫
  float foamAmount = 1.0 - clamp(jacobian, 0.0, 1.0);
  foamAmount = pow(foamAmount, 0.5); // 软化边缘

  return foamAmount;
}

float calculateFoam(vec3 normal, float waveHeight, vec2 worldPos, float time) {
  // === 基于坡度的泡沫（法线偏离程度） ===
  float steepness = 1.0 - normal.y; // normal.y越小，坡度越陡
  steepness = smoothstep(0.3, 0.8, steepness);

  // === 基于波高的泡沫 ===
  float heightFoam = smoothstep(0.15, 0.6, abs(waveHeight * 0.3));

  // === 时间变化的噪声纹理（模拟泡沫的动态性） ===
  vec2 foamUV1 = worldPos * 0.2 + time * 0.08;
  vec2 foamUV2 = worldPos * 0.35 + time * 0.12;

  // 多层噪声叠加
  float foamNoise1 = sin(foamUV1.x * 12.0) * sin(foamUV1.y * 10.0) * 0.5 + 0.5;
  float foamNoise2 = cos(foamUV2.x * 18.0 + time * 0.4) * cos(foamUV2.y * 15.0) * 0.5 + 0.5;
  float foamNoise = mix(foamNoise1, foamNoise2, 0.6);

  // 噪声阈值化，产生泡沫斑块
  foamNoise = smoothstep(0.35, 0.75, foamNoise);

  // 综合泡沫强度
  return max(steepness * 0.7, heightFoam * 0.5) * foamNoise;
}
// ====================== 以上：泡沫计算 ======================

void main() {
  // 时间
  float time = uTime;

  // 归一化法线
  vec3 normal = normalize(vNormal);
  // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  // 计算光照方向
  vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

  // 计算半程向量
  vec3 halfwayDir = normalize(lightDir + viewDir);

  // // 基础光照
  // float NdotL = max(dot(normal, lightDir), 0.0);
  // float NdotH = max(dot(normal, halfwayDir), 0.0);

  // =============== 水体颜色计算 ===============
  // 水体颜色计算
  // vec3 waterColor = calculateDepthColor(uWaterColor, depth);
  vec3 waterColor = calculateDepthColor(uWaterColor, vWaterDepth);
  // 颜色衰减
  vec3 attenuatedColor = applyWaterColorAttenuation(waterColor, vWaterDepth);

  // =============== 折射效果计算 ===============
  vec2 refractionOffset = calculateRefractionOffset(normal, viewDir, 0.05);
  vec3 refractedColor = vec3(0.0);

  // 如果有场景纹理，计算折射颜色
  // refractedColor = calculateRefractedColor(screenCoord, normal, viewDir, uSceneTexture, 0.05);

  // =============== 次表面散射计算 ===============
  // 方法1：使用多光源散射
  vec3 multiLightSSS = calculateMultiLightSSS(vWorldPosition, normal, viewDir, vWaterDepth);

  // 方法2：使用物理散射（如果性能允许）
  vec3 physicalSSS = calculatePhysicalSSS(
    vWorldPosition,
    normal,
    lightDir,
    viewDir,
    vWaterDepth,
    uLightColor,
    0 // 水体类型可以作为uniform
  );

  // 根据需要选择使用哪种方法
  vec3 finalSSS = multiLightSSS; // 或者 physicalSSS

  // =============== 泡沫计算 ===============
  // float foam = calculateFoam(normal, vWaveHeight, vWorldPosition.xz, time);
  float foam = calculateJacobianFoam(vWorldPosition.xz, time, vFoam);
  vec3 albedo = mix(waterColor, vec3(1.0), foam * 0.05);

  // 设置金属度
  float metallic = 0.02;
  // 设置粗糙度
  float roughness = 0.1;
  // 动态粗糙度（基于波浪和泡沫）
  float dynamicRoughness = WATER_BASE_ROUGHNESS + abs(vWaveHeight) * 0.02 + foam * 0.1;

  // 计算直接光照 Radiance
  float NdotL = max(dot(normal, lightDir), 0.0);
  vec3 directDiffuse = calculateDirectDiffuse(
    albedo,
    metallic,
    normal,
    viewDir,
    lightDir,
    0.5,
    vec3(1.0, 0.8, 0.6),
    vec3(0.1, 0.4, 0.7)
  );
  vec3 directSpecular = CookTorranceSpecularBRDF(albedo, dynamicRoughness, metallic, normal, viewDir, lightDir, 5.0);
  vec3 directBRDF = directDiffuse + directSpecular;
  vec3 directRadiance = directBRDF * uLightColor * NdotL;

  // 计算环境光照 Radiance
  vec3 envRadiance = vec3(0.0);
  vec3 envDiffuse = calculateEnvDiffuse(albedo, normal, lightDir, viewDir, 0.0, metallic);
  vec3 envSpecular = calculateEnvSpecular(albedo, normal, viewDir, uReflectance, metallic, dynamicRoughness);
  envRadiance = envDiffuse + envSpecular;

  // 计算直接光照 + 环境光照
  vec3 radiance = directRadiance + envRadiance + finalSSS;

  // 透明度计算
  float NdotV = max(dot(normal, viewDir), 0.0);
  float alpha = calculateWaterAlpha(foam, vWaterDepth, NdotV);

  // 一定不要忘记做 Gamma 校正
  radiance = pow(clamp(radiance, 0.0, 1.0), vec3(1.0 / 2.2));

  // 测试3：检查displacement纹理采样
  vec4 disp = texture2D(uDisplacementMap, vTexCoord);
  gl_FragColor = vec4(vec3(disp) * vec3(100.0), 1.0); // 放大查看

  gl_FragColor = vec4(radiance, alpha);
  // gl_FragColor = vec4(normal * vec3(100.0), 1.0);
  // gl_FragColor = vec4(vTexCoord, 0.0, 1.0);
  // gl_FragColor = vec4(finalSSS, 1.0);
  // gl_FragColor = vec4(vec3(texture2D(uDisplacementMap, vTexCoord).y), 1.0);
  // gl_FragColor = vec4(vec3(0.6, 0.3, 0.1), 1.0);

  vec3 upwelling = vec3(0, 0.2, 0.3); // 水中上涌光线颜色（偏蓝绿）
  vec3 sky = vec3(0.69, 0.84, 1); // 天空颜色（浅蓝）
  vec3 air = vec3(0.1, 0.1, 0.1); // 空气颜色（深灰）
  float nSnell = 1.34; // 水的折射率
  float Kdiffuse = 0.91;
  float reflectivity = 0.0;

  vec3 nI = viewDir; // 入射方向向量
  vec3 nN = normalize(normal); // 表面法向量
  float costhetai = abs(dot(nI, nN)); // 入射角余弦值
  vec3 reflectDir = reflect(-viewDir, normal);

  float thetai = acos(costhetai); // 入射角
  float sinthetat = sin(thetai) / nSnell; // 折射角正弦（斯涅尔定律）
  float thetat = asin(sinthetat); // 折射角

  if (sinthetat > 1.0) {
    // 全反射情况
    reflectivity = 1.0;
  } else if (thetai == 0.0) {
    // 垂直入射的特殊情况
    reflectivity = (nSnell - 1.0) / (nSnell + 1.0);
    reflectivity = reflectivity * reflectivity;
  } else {
    // 一般情况：完整的菲涅尔公式
    float fs = sin(thetat - thetai) / sin(thetat + thetai);
    float ts = tan(thetat - thetai) / tan(thetat + thetai);
    reflectivity = 0.5 * (fs * fs + ts * ts);
  }

  float dist = length(uCameraPos - vWorldPosition) * Kdiffuse;
  dist = 0.2;

  vec3 color = dist * (reflectivity * sky + (1.0 - reflectivity) * upwelling) + (1.0 - dist) * air;
  color = pow(color, vec3(1.0 / 2.2));

  gl_FragColor = vec4(color, 1.0);
}

// ============================= Backup2(new) =============================
// FFTOceanFragment.glsl
#ifdef GL_ES
precision highp float;
#endif

// 从 Vertex shader 传入的 Fragment varying
varying vec3 vOriginalWorldPosition;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying float vFoam; // 传递泡沫因子（雅可比值）
varying float vWaterDepth;
varying float vWaveHeight;

uniform vec3 uCameraPos;
// 光照参数
uniform vec3 uLightColor;
uniform vec3 uLightPos;
uniform vec3 uLightDir;

// 水体颜色参数
uniform vec3 uWaterColor;
uniform vec3 uDeepWaterColor;
uniform vec3 uShallowWaterColor;

// 水体物理参数
uniform float uTransparency;
uniform float uReflectance;
uniform float uRefractiveIndex;
uniform float uFresnelPower;
uniform float uSpecularPower;
uniform float uSpecularStrength;
uniform float uFoamThreshold;

// 波浪控制参数
// uniform float uTime;

// Textures
uniform sampler2D uDiffuseMap;
uniform sampler2D uNormalMap;
uniform samplerCube uEnvironmentMap;
uniform int uUseDiffuseMap;
uniform int uUseNormalMap;
uniform int uUseEnvironmentMap;

uniform sampler2D uDisplacementMap; // IFFT 生成的位移贴图
uniform sampler2D uGradientMap; // IFFT 生成的梯度贴图
uniform sampler2D uDispDerivativeMap; // IFFT 生成的位移导数贴图

// 材质属性修正：水的真实物理参数
const float WATER_IOR = 1.33; // 水的折射率
const float AIR_IOR = 1.0; // 空气折射率
const float WATER_METALLIC = 0.02; // 水的金属度（几乎为非金属）
const float WATER_BASE_ROUGHNESS = 0.008; // 水的基础粗糙度（非常光滑）
const vec3 WATER_F0 = vec3(0.02); // 水的基础反射率

// 深度和颜色参数
const float DEPTH_ATTENUATION = 0.05; // 深度衰减系数
const float FOAM_THRESHOLD = 0.4; // 泡沫阈值

// Constant
#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.28318530717958623199592693708837
#define INV_PI 0.31830988618379067154
#define INV_TWO_PI 0.1591549430918953456082

// ==================== 结构化材质属性和所占比重 ====================
/**
 * 水的材质属性：描述水这种物质的固有光学特性
 */
struct WaterProperties {
  vec3 baseColor; // 水的基础颜色
  float ambientFactor; // 对环境光的反射效率 (0-1)
  float diffuseFactor; // 对直接光的漫反射效率 (0-1)
  float specularFactor; // 镜面反射强度 (0-1)
  float shininess; // 光泽度（影响高光尺寸）
  float subsurfaceFactor; // 次表面散射强度 (0-2)
};

/**
 * 光照强度：描述当前光照和观察条件下各种光照的实际强度
 */
struct LightingIntensities {
  float ambient; // 环境光可见度
  float diffuse; // 漫反射强度（基于Lambert定律）
  float specular; // 镜面反射强度（基于Blinn-Phong）
  float subsurface; // 次表面散射强度
  float fresnel; // 菲涅尔反射强度
};

// ==================== Water Color ====================
// 基于深度的颜色混合
// vec3 calculateDepthColor(vec3 shallowWaterColor, vec3 deepWaterColor, float depth) {
//   // 指数衰减：模拟光在水中的衰减
//   float depthFactor = 1.0 - exp(-depth * 0.1);

//   return mix(shallowWaterColor, deepWaterColor, depthFactor);
// }

// 考虑不同波长的衰减（红光衰减最快）
// vec3 applyWaterColorAttenuation(vec3 color, float depth) {
//   vec3 attenuationCoeff = vec3(0.3, 0.1, 0.05); // RGB衰减系数
//   vec3 attenuation = exp(-attenuationCoeff * depth);
//   return color * attenuation;
// }

WaterProperties getWaterProperties(int waterType, float turbidity) {
  WaterProperties props;

  // 根据水体类型设置基础颜色
  if (waterType == 0) {
    // 深海
    props.baseColor = vec3(0.0, 0.15, 0.4);
  } else if (waterType == 1) {
    // 浅海
    props.baseColor = vec3(0.0, 0.25, 0.5);
  } else if (waterType == 2) {
    // 湖泊
    props.baseColor = vec3(0.0, 0.2, 0.45);
  } else {
    // 河流/浑浊水
    props.baseColor = vec3(0.1, 0.2, 0.3);
  }

  // 浑浊度影响：浑浊水更偏绿黄色
  vec3 turbidityTint = vec3(0.3, 0.4, 0.2);
  props.baseColor = mix(props.baseColor, turbidityTint, turbidity);

  // 设置光学特性
  props.ambientFactor = 0.3; // 水对环境光的反射效率较低
  props.diffuseFactor = 0.4; // 水的漫反射效率中等
  props.specularFactor = mix(1.0, 0.6, turbidity); // 浑浊度降低镜面反射
  props.shininess = mix(64.0, 32.0, turbidity); // 浑浊度降低光泽度
  props.subsurfaceFactor = mix(1.2, 0.8, turbidity); // 浑浊度影响次表面散射

  return props;
}

// ==================== PBR 材质参数 ====================
struct PBRMaterial {
  vec3 albedo; // 基础颜色 (反射率)
  float metallic; // 金属度 [0,1]
  float roughness; // 粗糙度 [0,1]
  float ao; // 环境光遮蔽 [0,1]
  vec3 normal; // 表面法线
  vec3 emission; // 自发光
};

// ==================== Fresnel ====================
// Schlick近似（更快，略不精确）
// float fresnelSchlick(float cosTheta, float waterIOR, float airIOR) {
//   // 水的F0值
//   float F0 = pow((airIOR - waterIOR) / (airIOR + waterIOR), 2.0); // ≈ 0.02
//   return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
// }
// Schlick 近似
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float calculateFresnelReflectivityAlgebraic(vec3 normal, vec3 viewDir, float waterIOR, float airIOR) {
  float reflectivity = 0.0;
  // costhetai = max(dot(nI, nN),0.0); // 入射角余弦值，nI - 入射方向向量，nN - 表面法向量
  float costhetai = max(dot(viewDir, normal), 0.0);
  float sinthetai = sqrt(1.0 - costhetai * costhetai);
  // 折射角正弦（斯涅尔定律）
  float sinthetat = airIOR * sinthetai / waterIOR;
  float costhetat = sqrt(1.0 - sinthetat * sinthetat);

  float n1 = airIOR; // 1.0
  float n2 = waterIOR; // 1.33

  if (sinthetat > 1.0) {
    // 全反射情况
    reflectivity = 1.0;
  } else {
    // 一般情况：完整的菲涅尔公式
    float fs = (n1 * costhetai - n2 * costhetat) / (n1 * costhetai + n2 * costhetat);
    float ts = (n2 * costhetai - n1 * costhetat) / (n2 * costhetai + n1 * costhetat);
    reflectivity = 0.5 * (fs * fs + ts * ts);
  }

  return reflectivity;
}

// float calculateFresnelReflectivityTrigonometric(vec3 normal, vec3 viewDir, float waterIOR, float airIOR) {
//   float reflectivity = 0.0;
//   // costhetai = max(dot(nI, nN),0.0); // 入射角余弦值，nI - 入射方向向量，nN - 表面法向量
//   float costhetai = max(dot(viewDir, normal), 0.0);

//   float thetai = acos(costhetai); // 入射角
//   float sinthetat = airIOR * sin(thetai) / waterIOR; // 折射角正弦（斯涅尔定律）
//   float thetat = asin(sinthetat); // 折射角

//   if (sinthetat > 1.0) {
//     // 全反射情况
//     reflectivity = 1.0;
//   } else if (thetai == 0.0) {
//     // 垂直入射的特殊情况
//     reflectivity = (waterIOR - 1.0) / (waterIOR + 1.0);
//     reflectivity = reflectivity * reflectivity;
//   } else {
//     // 一般情况：完整的菲涅尔公式
//     float fs = sin(thetat - thetai) / sin(thetat + thetai);
//     float ts = tan(thetat - thetai) / tan(thetat + thetai);
//     reflectivity = 0.5 * (fs * fs + ts * ts);
//   }

//   return reflectivity;
// }

// 考虑粗糙度的菲涅尔反射 (用于IBL)
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}

float calculateRealisticFresnel(vec3 normal, vec3 viewDir, float roughness) {
  float cosTheta = max(dot(normal, viewDir), 0.0);

  // 基础菲涅尔反射率（水的F0约为0.02）
  float F0 = 0.02;

  // Schlick近似，但添加粗糙度修正
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);

  // 关键：确保fresnel值在合理范围内
  fresnel = clamp(fresnel, 0.0, 0.6); // 限制最大值为0.8

  // 粗糙表面会降低反射强度
  fresnel *= mix(1.0, 0.3, roughness);

  // 限制最大反射强度，真实水面很少达到100%反射
  // fresnel = min(fresnel, 0.8);

  return fresnel;
}

// ==================== Normal Distribution Function ====================
// Trowbridge-Reitz GGX/GTR2
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;

  float nom = a2;
  float denom = NdotH2 * (a2 - 1.0) + 1.0;
  denom = M_PI * denom * denom;

  return nom / denom;
}

// ==================== 几何衰减函数 (Geometry Function) ====================
// Smith's method
float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = r * r / 8.0;

  float nom = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return nom / denom;
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2 = geometrySchlickGGX(NdotV, roughness);
  float ggx1 = geometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

// ==================== 色调映射 ====================
// ACES 色调映射
vec3 ACESToneMapping(vec3 color) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;

  return clamp(color * (a * color + b) / (color * (c * color + d) + e), 0.0, 1.0);
}

// ==================== PBR 直接光照计算 ====================
vec3 calculateDirectLighting(PBRMaterial material, vec3 V, vec3 L, vec3 lightColor) {
  vec3 N = material.normal;
  vec3 H = normalize(V + L);

  // 光照向量
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float HdotV = max(dot(H, V), 0.0);

  // 计算基础反射率 F0
  // 对于非金属，F0约为0.04；对于金属，F0等于albedo
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, material.albedo, material.metallic);

  // Cook-Torrance BRDF
  float NDF = distributionGGX(N, H, material.roughness);
  float G = geometrySmith(N, V, L, material.roughness);
  vec3 F = fresnelSchlick(HdotV, F0);

  // 计算镜面反射项
  vec3 numerator = NDF * G * F;
  float denominator = 4.0 * NdotV * NdotL + 0.001; // 防止除零
  vec3 specular = numerator / denominator;

  // kS 是镜面反射的能量比例
  vec3 kS = F;
  // kD 是漫反射的能量比例
  vec3 kD = vec3(1.0) - kS;

  // 金属没有漫反射
  kD *= 1.0 - material.metallic;

  // Lambert 漫反射
  vec3 diffuse = material.albedo / M_PI;

  // 最终的反射率方程
  vec3 Lo = (kD * diffuse + specular) * lightColor * NdotL;

  return Lo;
}

// ==================== IBL 环境光照 (简化版本) ====================
vec3 calculateIBL(PBRMaterial material, vec3 V, samplerCube environmentMap) {
  vec3 N = material.normal;
  vec3 R = reflect(-V, N);

  float NdotV = max(dot(N, V), 0.0);

  // 计算F0
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, material.albedo, material.metallic);

  // 菲涅尔反射 (考虑粗糙度)
  vec3 F = fresnelSchlickRoughness(NdotV, F0, material.roughness);

  vec3 kS = F;
  vec3 kD = 1.0 - kS;
  kD *= 1.0 - material.metallic;

  // 漫反射IBL (使用环境贴图模拟)
  vec3 irradiance = textureCube(environmentMap, N).rgb;
  vec3 diffuse = irradiance * material.albedo;

  // 镜面反射IBL
  // 根据粗糙度调整采样的mip level
  float mipLevel = material.roughness * 7.0; // 假设环境贴图有8个mip层
  vec3 prefilteredColor = textureCube(environmentMap, R).rgb;

  // BRDF积分查找表 (这里用简化近似)
  float roughness2 = material.roughness * material.roughness;
  vec2 envBRDF = vec2(
    mix(1.0, 0.0, roughness2), // scale
    mix(0.0, 1.0, roughness2) // bias
  );

  vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);

  // 组合漫反射和镜面反射
  vec3 ambient = (kD * diffuse + specular) * material.ao;

  return ambient;
}

// ==================== 主要的 PBR 着色函数 ====================
vec3 calculatePBRLighting(
  PBRMaterial material,
  vec3 worldPos,
  vec3 viewPos,
  vec3 lightDir,
  vec3 lightColor,
  samplerCube environmentMap
) {
  vec3 V = normalize(viewPos - worldPos);
  vec3 L = normalize(-lightDir); // 光线方向

  // 计算直接光照
  vec3 directLighting = calculateDirectLighting(material, V, L, lightColor);

  // 计算环境光照 (IBL)
  vec3 ambientLighting = calculateIBL(material, V, environmentMap);

  // 合成最终颜色
  vec3 color = directLighting + ambientLighting + material.emission;

  // 色调映射和伽马校正
  color = ACESToneMapping(color);
  color = pow(color, vec3(1.0 / 2.2)); // 伽马校正

  return color;
}

// ==================== Subsurface Scattering ====================
float sss_intensity(
  int status,
  vec3 lightDir,
  vec3 viewDir,
  vec3 normal,
  float distortion,
  float waveHeight,
  float SSSMask
) {
  if (status == 0) {
    return 0.0;
  }

  // 扭曲法线，模拟光在水中的散射路径
  vec3 h = normalize(viewDir + normal * distortion);

  // 计算散射强度：考虑观看角度和光照角度
  float intensity = pow(clamp(dot(h, -lightDir), 0.0, 1.0), 4.0) * pow(waveHeight, 1.0) * SSSMask;

  // 快速次表面散射近似
  if (status == 2) {
    h = normalize(lightDir + normal * distortion);
    intensity = pow(clamp(dot(viewDir, -h), 0.0, 1.0), 4.0) * pow(waveHeight, 1.0) * SSSMask;
    return intensity;
  }

  return intensity;
}

// ==================== Lighting Intensity ====================
LightingIntensities calculateLightingIntensities(
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float waveHeight,
  float fresnelFactor,
  float shininess
) {
  LightingIntensities intensities;

  // 基础光照计算
  float NdotL = max(dot(normal, lightDir), 0.0);
  float NdotV = max(dot(normal, viewDir), 0.0);
  vec3 halfwayDir = normalize(lightDir + viewDir);
  float NdotH = max(dot(normal, halfwayDir), 0.0);

  // 1. 环境光强度：基本为常量
  intensities.ambient = 1.0;

  // 2. 漫反射强度：Lambert定律
  intensities.diffuse = NdotL;

  // 3. 镜面反射强度：Blinn-Phong模型，使用材质的shininess
  intensities.specular = pow(NdotH, shininess) * (1.0 + abs(waveHeight));

  // 4. 次表面散射强度：边缘光效应
  float rimLighting = pow(1.0 - NdotV, 2.0);
  float backLighting = pow(clamp(dot(viewDir, -lightDir), 0.0, 1.0), 3.0);
  intensities.subsurface = (rimLighting + backLighting) * 0.5;

  // 5. 菲涅尔强度
  intensities.fresnel = fresnelFactor;

  return intensities;
}

// ==================== Environment Reflection ====================
vec3 calculateEnvironmentReflection(vec3 normal, vec3 viewDir) {
  vec3 reflectDir = reflect(-viewDir, normal);

  if (uUseEnvironmentMap == 1) {
    return textureCube(uEnvironmentMap, reflectDir).rgb;
  } else {
    // 简单的天空颜色梯度
    float skyFactor = max(reflectDir.y, 0.0);
    return mix(vec3(0.1, 0.3, 0.5), vec3(0.7, 0.9, 1.0), skyFactor);
  }
}

// ==================== Foam ====================

// ==================== Perturb Normal ====================
vec3 perturbNormal(int perturbationMode) {
  vec2 texelSize = vec2(1.0) / vec2(128.0); // 根据您的分辨率调整

  vec2 gradient = vec2(0.0, 0.0);

  // 梯度采样时进行扰动，并选择使用哪个梯度
  if (perturbationMode == 0) {
    vec2 gradientCenter = texture2D(uGradientMap, vTexCoord).xy;
    gradient = gradientCenter;
  } else if (perturbationMode == 1) {
    vec2 gradientRight = texture2D(uGradientMap, vTexCoord + vec2(texelSize.x, 0.0)).xy;
    gradient = gradientRight;
  } else if (perturbationMode == 2) {
    vec2 gradientUp = texture2D(uGradientMap, vTexCoord + vec2(0.0, texelSize.y)).xy;
    gradient = gradientUp;
  }

  vec2 detailGradient = texture2D(uGradientMap, vTexCoord * 4.0).xy * 0.3;

  // 法线计算扰动（这里是关键）
  // vec3 normal = normalize(
  //   vec3(
  //     -gradient.x * 2.0, // X分量
  //     1.0, // Y分量（向上）
  //     -gradient.y * 2.0 // Z分量
  //   )
  // );

  vec3 normal = normalize(vec3(-(gradient.x + detailGradient.x), 1.0, -(gradient.y + detailGradient.y)));

  return normal;
}

// ==================== 改进的环境反射采样 ====================
vec3 calculateRealisticEnvironmentReflection(
  vec3 normal,
  vec3 viewDir,
  float roughness,
  samplerCube environmentMap,
  float distortionStrength
) {
  // 1. 计算基础反射方向
  vec3 reflectDir = reflect(-viewDir, normal);

  // 2. 添加基于粗糙度的扰动（模拟微表面散射）
  float mipLevel = roughness * 7.0; // 根据粗糙度选择mip层级

  // 3. 添加轻微的方向扰动（模拟波浪造成的反射扰动）
  vec2 distortion = normal.xz * distortionStrength;
  vec3 distortedReflectDir = normalize(reflectDir + vec3(distortion.x, 0.0, distortion.y) * 0.1);

  // 4. 采样环境贴图
  vec3 envColor = textureCube(environmentMap, distortedReflectDir).rgb;
  // 降低饱和度，让反射更自然
  float luminance = dot(envColor, vec3(0.299, 0.587, 0.114));
  envColor = mix(vec3(luminance), envColor, 0.6); // 降低饱和度
  // 进一步减弱反射强度
  envColor *= 0.8;

  // 5. 大气散射效果：远处的反射会偏蓝
  float skyFactor = max(distortedReflectDir.y, 0.0);
  vec3 atmosphericTint = mix(vec3(0.8, 0.9, 1.0), vec3(1.0), skyFactor);
  envColor *= atmosphericTint;

  // 6. 降低整体强度，真实水面不会完全反射天空
  envColor *= 0.6;

  return envColor;
}

// ==================== 水体颜色混合 ====================
vec3 calculateWaterBodyColor(vec3 baseWaterColor, float waterDepth, vec3 lightDir, vec3 viewDir, vec3 normal) {
  // 1. 深度影响的水体颜色
  vec3 shallowColor = vec3(0.2, 0.26, 0.36); // 更深的浅水色
  vec3 deepColor = vec3(0.0, 0.02, 0.03); // 更深的深水色
  float depthFactor = 1.0 - exp(-waterDepth * 0.1);
  vec3 waterColor = mix(shallowColor, deepColor, depthFactor);

  // 2. 简单的次表面散射
  vec3 H = normalize(viewDir + normal * 0.5); // 轻微扭曲的半角向量
  float sss = pow(max(dot(H, -lightDir), 0.0), 3.0) * 0.3;
  waterColor += vec3(0.0, 0.3, 0.1) * sss;

  return waterColor;
}

// ==================== 综合的水面着色 ====================
vec3 calculateRealisticWaterShading(
  vec3 worldPos,
  vec3 normal,
  vec3 viewPos,
  vec3 viewDir,
  vec3 lightDir,
  vec3 lightColor,
  samplerCube environmentMap,
  float waterDepth,
  float waveHeight
) {
  // 1. 计算表面粗糙度（基于波浪）
  float baseRoughness = 0.02; // 水的基础粗糙度
  float waveRoughness = abs(waveHeight) * 0.1; // 波浪增加粗糙度
  float totalRoughness = clamp(baseRoughness + waveRoughness, 0.01, 0.5);

  // 2. 计算真实的菲涅尔反射强度
  float fresnelStrength = calculateRealisticFresnel(normal, viewDir, totalRoughness);

  // 3. 计算水体本身的颜色
  vec3 waterBodyColor = calculateWaterBodyColor(vec3(0.0, 0.2, 0.4), waterDepth, lightDir, viewDir, normal);

  // 4. 计算环境反射
  vec3 environmentReflection = calculateRealisticEnvironmentReflection(
    normal,
    viewDir,
    totalRoughness,
    environmentMap,
    0.3 // 扰动强度
  );
  vec3 coolReflection = environmentReflection * vec3(0.8, 0.9, 1.1);

  // 5. 计算直接光照（简化的Lambert）
  float NdotL = max(dot(normal, lightDir), 0.0);
  vec3 directLighting = waterBodyColor * lightColor * NdotL * 0.5;

  // 6. 混合水体颜色和环境反射
  // 关键：不是简单的lerp，而是基于物理的混合
  // vec3 finalColor =
  //   waterBodyColor * (1.0 - fresnelStrength) + environmentReflection * fresnelStrength * 0.7 + directLighting;
  vec3 finalColor = waterBodyColor * (1.0 - fresnelStrength) + coolReflection * fresnelStrength * 0.3; // 降低反射强度

  // 7. 添加环境光（防止过暗）
  vec3 ambientColor = waterBodyColor * 0.5;
  finalColor += ambientColor;

  // 8. 距离衰减效果：远处更偏向水体本身颜色
  // float distanceFromCamera = length(worldPos - viewDir); // 简化
  // float distanceFactor = clamp(distanceFromCamera / 1000.0, 0.0, 1.0);
  // finalColor = mix(finalColor, waterBodyColor, distanceFactor * 0.3);
  // 距离越远，颜色越偏向深蓝和雾霾色
  float distanceFromCamera = length(worldPos - viewPos);
  float atmosphericFactor = 1.0 - exp(-distanceFromCamera * 0.0008);
  vec3 atmosphericColor = vec3(0.4, 0.6, 0.8); // 大气色调
  // finalColor = mix(finalColor, atmosphericColor, atmosphericFactor * 0.4);

  // 9. 泡沫颜色混合
  float foamFactor = clamp(vFoam, 0.0, 1.0);
  foamFactor = smoothstep(0.4, 0.8, foamFactor);
  vec3 foamColor = vec3(0.95, 0.95, 0.98);
  finalColor = mix(finalColor, foamColor, 1.0 - foamFactor);

  // 10. 在最终颜色计算前添加
  float viewAngle = dot(normal, viewDir);
  float edgeFactor = 1.0 - abs(viewAngle);
  // 边缘区域更偏向深色
  vec3 edgeColor = vec3(0.0, 0.05, 0.2);
  // finalColor = mix(finalColor, edgeColor, edgeFactor * 0.3);

  return finalColor;
}

// ==================== 在main()中的使用方法 ====================
// void main() {
//   // 直接在 Fragment Shader 中计算法线
//   vec2 gradient = texture2D(uGradientMap, vTexCoord).xy;
//   // gl_FragColor = vec4(gradient.x, gradient.y, 0.0, 1.0);
//   // gl_FragColor = vec4(gradient.x * 0.5 + 0.5, gradient.y * 0.5 + 0.5, 0.0, 1.0);
//   float dDx_dx = texture2D(uDispDerivativeMap, vTexCoord).x;
//   float dDz_dz = texture2D(uDispDerivativeMap, vTexCoord).y;
//   float dDx_dz = texture2D(uDispDerivativeMap, vTexCoord).z;
//   float dDz_dx = texture2D(uDispDerivativeMap, vTexCoord).w;
//   float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;

//   // vec4 displacement = texture2D(uDisplacementMap, vTexCoord);
//   // gl_FragColor = vec4(displacement.xyz, 1.0);
//   // return;
//   // gl_FragColor = vec4(vec3(displacement.w, displacement.w, displacement.w), 1.0);
//   // return;
//   // 临时调试：完全禁用光照
//   // gl_FragColor = vec4(0.0, 0.3, 0.6, 1.0); // 纯蓝色
//   // return;
//   // gradient = vec2(gradient.x * 0.5 + 0.5, gradient.y * 0.5 + 0.5); // <== 做了平滑处理（从这里继续）
//   gradient = vec2(gradient.x / (1.0 + dDx_dx), gradient.y / (1.0 + dDz_dz));
//   // 增强法线强度
//   // vec3 N = normalize(vec3(-gradient.x * 2.0, 1.0, -gradient.y * 2.0));
//   // vec3 N = normalize(vec3(-gradient.x, 1.0, -gradient.y));
//   vec3 N = normalize(
//     vec3(
//       -gradient.x * (1.0 + dDz_dz) + gradient.y * dDz_dx,
//       jacobian, // 不是固定的 1.0
//       -gradient.y * (1.0 + dDx_dx) + gradient.x * dDx_dz
//     )
//   );
//   gl_FragColor = vec4(N * 0.5 + 0.5, 1.0);
//   // return;
//   // 获取基础数据
//   // vec3 N = normalize(vNormal);
//   vec3 V = normalize(uCameraPos - vWorldPosition);
//   vec3 L = normalize(uLightDir);

//   // 使用改进的水面着色
//   vec3 finalColor = calculateRealisticWaterShading(
//     vWorldPosition,
//     N,
//     uCameraPos,
//     V,
//     L,
//     uLightColor,
//     uEnvironmentMap,
//     vWaterDepth,
//     vWaveHeight
//   );

//   // Gamma 校正
//   finalColor = pow(finalColor, vec3(1.0 / 2.2)); // 从2.2改为2.0

//   // 整体提亮30%
//   finalColor *= 1.3;

//   gl_FragColor = vec4(finalColor, 1.0);

//   // 调试选项
//   // gl_FragColor = vec4(vec3(calculateRealisticFresnel(N, V, 0.1)), 1.0); // 查看菲涅尔
//   // gl_FragColor = vec4(calculateWaterBodyColor(vec3(0.0, 0.2, 0.4), vWaterDepth, L, V, N), 1.0); // 查看水体颜色

// }

// void main() {
//     // 基础向量
//   vec3 N = perturbNormal(2);
//     // 设置材质属性
//     PBRMaterial material;
//     material.albedo = vec3(0.02, 0.15, 0.4);     // 水的基础颜色
//     material.metallic = 0.0;                      // 水不是金属
//     material.roughness = mix(0.01, 0.3, 0.1); // 根据波浪调整粗糙度
//     material.ao = 1.0;                            // 无环境光遮蔽
//     material.normal = vNormal;      // 从波浪计算的法线
//     material.emission = vec3(0.0);                // 水无自发光

//     // 计算最终颜色
//     vec3 finalColor = calculatePBRLighting(
//         material,
//         vWorldPosition,
//         uCameraPos,
//         uLightDir,
//         uLightColor,
//         uEnvironmentMap
//     );

//     gl_FragColor = vec4(finalColor, 1.0);
// }

// void main() {
//   // 基础向量
//   vec3 N = perturbNormal(2);
//   // vec3 N = normalize(vNormal);
//   vec3 V = normalize(uCameraPos - vWorldPosition);
//   vec3 L = normalize(uLightDir);

//   // 获取水的材质属性
//   WaterProperties waterProps = getWaterProperties(0, 0.1);

//   // 计算菲涅尔反射率
//   float reflectivity = calculateFresnelReflectivityAlgebraic(N, V, WATER_IOR, AIR_IOR);

//   // 计算各种光照强度
//   LightingIntensities intensities = calculateLightingIntensities(
//     N,
//     V,
//     L,
//     vWaveHeight,
//     reflectivity,
//     waterProps.shininess
//   );

//   // ============ 最终光照计算 ============

//   // 1. 环境光贡献 = 光照强度 × 材质反射效率 × 光源颜色
//   vec3 ambientColor = vec3(0.1, 0.1, 0.1);
//   vec3 ambientContribution = intensities.ambient * (waterProps.baseColor * waterProps.ambientFactor) * ambientColor;

//   // 2. 漫反射贡献 = 光照强度 × 材质反射效率 × 光源颜色
//   vec3 diffuseContribution = intensities.diffuse * (waterProps.baseColor * waterProps.diffuseFactor) * uLightColor;

//   // 3. 镜面反射贡献 = 光照强度 × 材质反射效率 × 光源颜色
//   vec3 specularContribution = intensities.specular * waterProps.specularFactor * uLightColor;
//   specularContribution = vec3(0.0);

//   // 4. 次表面散射贡献 = 光照强度 × 材质散射特性 × 光源颜色
//   vec3 subsurfaceContribution =
//     intensities.subsurface * (waterProps.baseColor * waterProps.subsurfaceFactor) * uLightColor;

//   // 5. 环境反射贡献 = 菲涅尔强度 × 环境颜色
//   vec3 envReflection = textureCube(uEnvironmentMap, reflect(-V, N)).rgb;
//   vec3 environmentContribution = intensities.fresnel * envReflection;

//   // ============ 合成最终颜色 ============

//   // 水体本身的颜色（直接光照）
//   vec3 waterBodyColor = ambientContribution + diffuseContribution + specularContribution + subsurfaceContribution;

//   // 根据菲涅尔效应混合水体颜色和环境反射
//   vec3 finalColor = mix(waterBodyColor, environmentContribution, intensities.fresnel * 1.0);

//   // finalColor = mix(finalColor, vec3(1.0), 1.0 - vFoam);

//   // Gamma校正
//   finalColor = pow(finalColor, vec3(1.0 / 2.2));

//   gl_FragColor = vec4(finalColor, 1.0);

//   // ============ 调试输出 ============
//   // gl_FragColor = vec4(waterProps.baseColor, 1.0);     // 查看水体基础颜色
//   // gl_FragColor = vec4(vec3(intensities.fresnel), 1.0); // 查看菲涅尔强度
//   // gl_FragColor = vec4(waterBodyColor, 1.0);            // 查看水体本身颜色
//   // gl_FragColor = vec4(N, 1.0);
//   // gl_FragColor = vec4(normalColor, 1.0);
//   // gl_FragColor = vec4(vec3(vFoam), 1.0);
//   // gl_FragColor = vec4(subsurfaceContribution, 1.0);

// }

void main() {
  // 时间
  // float time = uTime;

  vec3 displacement = texture2D(uDisplacementMap, vWorldPosition.xz * 0.002).xyz;
  gl_FragColor = vec4(displacement, 1.0);
  // return;

  // 直接在 Fragment Shader 中计算法线
  vec2 gradient = texture2D(uGradientMap, vTexCoord).xy;
  // vec2 gradient1 = texture2D(uGradientMap, vOriginalWorldPosition.xz * 0.000002).xy;
  // vec2 gradient2 = texture2D(uGradientMap, vOriginalWorldPosition.xz * 0.008).xy * 0.5;
  // gradient = gradient1 + gradient2;
  // gl_FragColor = vec4(gradient.x, gradient.y, 0.0, 1.0);
  // gl_FragColor = vec4(gradient.x * 0.5 + 0.5, gradient.y * 0.5 + 0.5, 0.0, 1.0);
  float dDx_dx = texture2D(uDispDerivativeMap, vTexCoord).x;
  float dDz_dz = texture2D(uDispDerivativeMap, vTexCoord).y;
  float dDx_dz = texture2D(uDispDerivativeMap, vTexCoord).z;
  float dDz_dx = texture2D(uDispDerivativeMap, vTexCoord).w;
  float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;

  // 归一化法线
  vec3 N = normalize(
    vec3(
      -gradient.x * (1.0 + dDz_dz) + gradient.y * dDz_dx,
      jacobian, // 不是固定的 1.0
      -gradient.y * (1.0 + dDx_dx) + gradient.x * dDx_dz
    )
  );
  vec3 normal = N;
  // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  // 计算光照方向
  vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

  // 计算半程向量
  vec3 halfwayDir = normalize(lightDir + viewDir);

  // 反射方向
  vec3 reflectDir = reflect(-viewDir, normal);

  // 光照参数
  vec3 upwelling = vec3(0, 0.2, 0.3); // 水中上涌光线颜色（偏蓝绿）
  vec3 sky = vec3(0.69, 0.84, 1); // 天空颜色（浅蓝）
  vec3 air = vec3(0.1, 0.1, 0.1); // 空气颜色（深灰）
  float nSnell = 1.34; // 水的折射率
  float reflectivity = 0.0; // 反射率
  float Kdiffuse = 0.91;

  reflectivity = calculateFresnelReflectivityAlgebraic(normal, viewDir, WATER_IOR, AIR_IOR);

  float dist = length(uCameraPos - vWorldPosition) * Kdiffuse;
  dist = 0.2;

  // sky = textureCube(uEnvironmentMap, vWorldPosition).rgb;

  vec3 color = dist * (reflectivity * sky + (1.0 - reflectivity) * upwelling) + (1.0 - dist) * air;
  // color = texture2D(uDisplacementMap, vTexCoord).rgb;
  // color = texture2D(uNormalMap, vTexCoord).rgb;
  // color = textureCube(uEnvironmentMap, vWorldPosition).rgb;
  // color = calculateDepthColor(uShallowWaterColor, uDeepWaterColor, vWaterDepth);
  // color = applyWaterColorAttenuation(color, vWaterDepth);

  color = pow(color, vec3(1.0 / 2.2));
  gl_FragColor = vec4(color, 1.0);
}

