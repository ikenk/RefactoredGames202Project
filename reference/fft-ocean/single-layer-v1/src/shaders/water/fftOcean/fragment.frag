#ifdef GL_ES
precision highp float;
#endif

// 从 Vertex shader 传入的 Fragment varying
varying vec3 vWorldPosition;
varying vec2 vTexCoord;
varying vec3 vNormal;
// varying float vWaveHeight;
// varying float vWaterDepth;
// varying float vFoam; // 传递泡沫因子（雅可比值）

uniform float uGeometrySize; // 海面网格 mesh 的大小
uniform float uTextureSize; // texture 的大小（实则是 spectrum 的分辨率）

uniform float uMagnificationXZ; // 水平位移放大系数
uniform float uMagnificationY; // 垂直位移放大系数

// 相机参数
uniform vec3 uCameraPos;

// 光照参数（LightSystem 推送）
uniform vec3 uLightRadiance;
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

// ==================== 法线（原 vertex shader 中的流程，含 magnification 修正） ====================
// 原始平面上的点 (x, 0, z) 经过位移后变成: P(x,z) = (x + Dx(x,z),  Dy(x,z),  z + Dz(x,z))
// 要求法线，需要两个切向量: ∂P/∂x = (1 + ∂Dx/∂x, ∂Dy/∂x, ∂Dz/∂x) = (1 + dDx_dx, slope.x, dDz_dx) 和 ∂P/∂z = (∂Dx/∂z, ∂Dy/∂z, 1 + ∂Dz/∂z) = (dDx_dz, slope.y, 1 + dDz_dz)
vec3 calculateNormal(vec2 uv) {
  vec2 slope = texture2D(uGradientMap, uv).xy;
  vec4 jd = texture2D(uDispDerivativeMap, uv);
  float dDx_dx = jd.r * uMagnificationXZ;
  float dDz_dz = jd.g * uMagnificationXZ;
  float dDx_dz = jd.b * uMagnificationXZ;
  float dDz_dx = jd.a * uMagnificationXZ;
  vec2 grad = slope * uMagnificationY;

  vec3 tangentX = vec3(1.0 + dDx_dx, grad.x, dDz_dx);
  vec3 tangentZ = vec3(dDx_dz, grad.y, 1.0 + dDz_dz);
  return normalize(cross(tangentZ, tangentX));
}

// ==================== Fresnel ====================
float calculateFresnel(vec3 normal, vec3 viewDir) {
  float F0 = pow((1.0 - uRefractiveIndex) / (1.0 + uRefractiveIndex), 2.0);
  float cosTheta = max(dot(normal, viewDir), 0.0);
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, uFresnelPower);
}

// ==================== Specular（Blinn-Phong） ====================
vec3 calculateSpecular(vec3 normal, vec3 viewDir, vec3 lightDir) {
  vec3 h = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, h), 0.0), uSpecularPower);
  return uLightRadiance * spec * uReflectance;
}

// ==================== 双曲正切的近似公式 ====================
float tanh_approx(float x) {
  // 简单的双曲正切近似
  float ex = exp(2.0 * x);
  return (ex - 1.0) / (ex + 1.0);
}

void main() {
  vec2 uv = vTexCoord;

  uv = fract(vWorldPosition.xz / uGeometrySize);

  vec3 normal = calculateNormal(uv);
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);
  vec3 lightDir = normalize(uLightDir);

  // Fresnel
  float fresnel = calculateFresnel(normal, viewDir);

  // 水色（波高驱动）
  float waveHeight = texture2D(uDisplacementMap, uv).y * uMagnificationY;
  // vec3 waterColor = mix(uDeepWaterColor, uShallowWaterColor, tanh(waveHeight * 0.5) * 0.5 + 0.5);
  // vec3 waterColor = mix(uDeepWaterColor, uShallowWaterColor, tanh_approx(waveHeight * 0.5) * 0.5 + 0.5);

  // 用陡度（法线偏离垂直的程度）代替高度
  float crest = 1.0 - normal.y; // 0=平, 1=陡
  crest = smoothstep(0.3, 0.7, crest); // 只在很陡的地方混 shallow
  vec3 waterColor = mix(uDeepWaterColor, uShallowWaterColor, crest);

  // 环境反射
  vec3 R = reflect(-viewDir, normal);
  R.y = max(R.y, 0.0); // 反射方向限制在上半球
  vec3 skyFallback = mix(vec3(0.7, 0.85, 1.0), vec3(0.35, 0.55, 0.85), R.y);
  vec3 envReflection =
    uUseEnvironmentMap == 1
      ? textureCube(uEnvironmentMap, reflect(-viewDir, normal)).rgb
      : skyFallback;

  // vec3 envReflection = vec3(0.0);
  envReflection *= vec3(0.5, 0.7, 1.0);

  // 组合
  vec3 color = mix(waterColor, envReflection, fresnel); // Fresnel 混合
  // color += calculateSpecular(normal, viewDir, lightDir); // 太阳高光

  // Gamma + 透明度
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
  // float alpha = mix(uTransparency, 1.0, foam * 0.6);
  // alpha = mix(alpha, 1.0, fresnel * 0.3);
  float alpha = 1.0;

  gl_FragColor = vec4(color, alpha);
  // gl_FragColor = vec4(envReflection, alpha);
  // gl_FragColor = vec4(vec3(fresnel), 1.0); // 看是不是黑斑位置 fresnel=1
  // gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
  // gl_FragColor = vec4(normal.xzy * 0.5 + 0.5, 1.0);
}

// // float baseScale = 0.002; // 粗糙层：每500m重复
// // float detailScale = 0.008; // 细节层：每125m重复
// // vec2 coord1 = vWorldPosition.xz * baseScale;
// // vec2 coord2 = vWorldPosition.xz * detailScale;
// // uv = coord1;
// // ========== 2. 采样贴图 ==========
// vec3 displacement = texture2D(uDisplacementMap, uv).xyz;

// vec2 slope = texture2D(uGradientMap, uv).xy;
// // vec2 slope1 = texture2D(uGradientMap, vWorldPosition.xz * 0.002).xy;
// // vec2 slope2 = texture2D(uGradientMap, vWorldPosition.xz * 0.008).xy * 0.5;
// // slope = slope1 + slope2;

// vec4 jacobianData = texture2D(uDispDerivativeMap, uv);
// float dDx_dx = jacobianData.r;
// float dDz_dz = jacobianData.g;
// float dDx_dz = jacobianData.b;
// float dDz_dx = jacobianData.a;
// float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;
// // float choppiness = 1.3;
// // float jacobian =
// //   (1.0 + choppiness * dDx_dx) * (1.0 + choppiness * dDz_dz) - choppiness * choppiness * dDx_dz * dDz_dx;
// // ========== 3. 构造法线 ==========
// // 方法一: 切线算法线
// vec3 tangentX = vec3(1.0 + dDx_dx, slope.x, dDz_dx);
// vec3 tangentZ = vec3(dDx_dz, slope.y, 1.0 + dDz_dz);
// vec3 normal = normalize(cross(tangentZ, tangentX));
// // 方法二: 梯度算法线
// vec2 gradient = vec2(slope.x / (1.0 + dDx_dx), slope.y / (1.0 + dDz_dz));
// normal = normalize(vec3(-gradient.x, 1.0, -gradient.y));
// // 方法三: 梯度 + 雅克比值算法线
// normal = normalize(
//   vec3(
//     -gradient.x * (1.0 + dDz_dz) + gradient.y * dDz_dx,
//     jacobian,
//     -gradient.y * (1.0 + dDx_dx) + gradient.x * dDx_dz
//   )
// );
// // 方法四: 使用从 vertex shader 中传递过来的 vNormal
// // normal = vNormal;
// // normal *= 500.0;

// // Debug Code
// // 斜度/梯度/法线 可视化
// // gl_FragColor = vec4(0.0, slope, 1.0);
// // gl_FragColor = vec4(0.0, gradient, 1.0);
// // gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
// // gl_FragColor = vec4(0.3, 0.3, 0.5, 1.0);

// // 高度可视化
// // float height = vWaveHeight; // 高度就是波峰/波谷的标志
// // 可视化波峰（红色）和波谷（蓝色）
// // if (height > 0.5) {
// //   gl_FragColor = vec4(1, 1, 0, 1); // 黄色：height > 0.5
// // } else if (height > 0.2) {
// //   gl_FragColor = vec4(1, 0.5, 0, 1); // 橙色：0.2 < height < 0.5
// // } else if (height > 0.0) {
// //   gl_FragColor = vec4(0, 1, 0, 1); // 绿色：0 < height < 0.2
// // } else if (height > -0.2) {
// //   gl_FragColor = vec4(0, 0.5, 1, 1); // 浅蓝：-0.2 < height < 0
// // } else {
// //   gl_FragColor = vec4(0, 0, 1, 1); // 深蓝：height < -0.2
// // }

// // choppiness 可视化
// // 水平位移的模长反映 choppiness 强度, 波峰处水平位移接近 0（理论上）,但实际上由于多波叠加，我们看的是变化率
// // float horizontalDisp = length(displacement.xz);
// // // 波峰判断：高度大 + 水平位移小
// // bool isPeak = height > 0.5 && horizontalDisp < 0.2;
// // // 波谷判断：高度小 + 水平位移大
// // bool isTrough = height < -0.3 && horizontalDisp > 0.2;
// // if (isPeak) {
// //   gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // 红色：波峰
// // } else if (isTrough) {
// //   gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); // 蓝色：波谷
// // } else {
// //   gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); // 绿色：过渡区
// // }

// // Jacobian 可视化
// // vec3 color;
// // if (jacobian < 0.0) {
// //   color = vec3(1.0, 0.0, 0.0); // 红色：折叠！
// // } else if (jacobian < 0.5) {
// //   color = vec3(1.0, 1.0, 0.0); // 黄色：即将折叠
// // } else if (jacobian < 1.0) {
// //   color = vec3(0.0, 1.0, 0.0); // 绿色：压缩
// // } else if (jacobian < 1.5) {
// //   color = vec3(0.0, 1.0, 1.0); // 青色：拉伸
// // } else {
// //   color = vec3(0.0, 0.0, 1.0); // 蓝色：过度拉伸
// // }
// // gl_FragColor = vec4(color, 1.0);

// // return;

// // 直接在 Fragment Shader 中计算法线

// // float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;

// // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

// // 计算视线方向
// vec3 viewDir = normalize(uCameraPos - vWorldPosition.xyz);

// // 计算光照方向
// vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

// // 计算半程向量
// vec3 halfwayDir = normalize(lightDir + viewDir);

// // 反射方向
// vec3 reflectDir = reflect(-viewDir, normal);

// gl_FragColor = vec4(0.3, 0.1, 0.5, 1.0);
// // gl_FragColor = vec4(vWaveHeight);

