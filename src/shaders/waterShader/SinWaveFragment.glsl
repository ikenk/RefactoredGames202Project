precision highp float;

// 从 Vertex shader 传入的 Fragment varying
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vWorldPosition;
varying float vWaveHeight;

// Camera 位置
uniform vec3 uCameraPos;
// lighting 位置和方向
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
// 光照参数
uniform float uSpecularPower;
uniform float uFresnelPower;

// 波浪控制参数
uniform float uTime;

// Textures
uniform sampler2D uDiffuseMap;
uniform sampler2D uNormalMap;
uniform sampler2D uEnvironmentMap;
uniform int uUseDiffuseMap;
uniform int uUseNormalMap;
uniform int uUseEnvironmentMap;

/**
 * 计算菲涅尔反射系数
 * 基于Schlick近似
 */
float calculateFresnel(vec3 viewDir, vec3 normal, float refractionIndex) {
  float cosTheta = max(dot(viewDir, normal), 0.0);
  float r0 = pow((1.0 - refractionIndex) / (1.0 + refractionIndex), 2.0);
  return r0 + (1.0 - r0) * pow(1.0 - cosTheta, uFresnelPower);
}

/**
 * 简单的Blinn-Phong光照计算
 */
vec3 calculateBlinnPhong(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 lightColor, vec3 materialColor) {
  // 环境光
  vec3 ambient = materialColor * 0.1;

  // 漫反射
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 diffuse = diff * lightColor * materialColor;

  // 镜面反射
  vec3 halfwayDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfwayDir), 0.0), uSpecularPower);
  vec3 specular = spec * lightColor;

  return ambient + diffuse + specular;
}

/**
 * 生成程序化泡沫
 * 基于波高和法线变化
 */
float calculateFoam(float waveHeight, vec3 normal) {
  // 基于波峰高度生成泡沫
  float heightFoam = smoothstep(0.3, 0.8, abs(waveHeight));

  // 基于法线变化（波浪陡峭程度）生成泡沫
  float normalFactor = 1.0 - abs(normal.y);
  float slopeFoam = smoothstep(0.4, 0.8, normalFactor);

  // 添加一些噪声变化
  float noise = sin(vWorldPosition.x * 10.0 + uTime * 2.0) * cos(vWorldPosition.z * 8.0 + uTime * 1.5);
  noise = (noise + 1.0) * 0.5; // 归一化到[0,1]

  return max(heightFoam, slopeFoam) * noise;
}

/**
 * 简单的水深效果
 * 基于世界坐标和波高模拟深浅变化
 */
vec3 calculateDepthColor(vec3 baseColor, float depth) {
  // 简单的深度衰减
  float depthFactor = exp(-depth * 0.1);
  return mix(uDeepWaterColor, baseColor, depthFactor);
}

void main() {
  // 归一化法线
  vec3 normal = normalize(vNormal);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  // 计算光照方向（这里假设使用定向光）
  vec3 lightDir = normalize(-uLightDir);

  // 基础水体颜色
  vec3 baseWaterColor = uWaterColor;

  // 如果有diffuse贴图，采样纹理颜色
  if (uUseDiffuseMap == 1) {
    vec3 texColor = texture2D(uDiffuseMap, vTexCoord).rgb;
    baseWaterColor *= texColor;
  }

  // 如果有法线贴图，调整法线
  if (uUseNormalMap == 1) {
    vec3 normalMapColor = texture2D(uNormalMap, vTexCoord).rgb;
    // 将法线贴图从[0,1]转换到[-1,1]
    vec3 normalMapNormal = normalize(normalMapColor * 2.0 - 1.0);
    // 简单混合（实际应该用TBN矩阵）
    normal = normalize(normal + normalMapNormal * 0.5);
  }

  // 计算深度颜色效果
  float depth = abs(vWaveHeight) + 1.0; // 简单的深度计算
  vec3 waterColor = calculateDepthColor(baseWaterColor, depth);

  // 计算菲涅尔效应
  float fresnel = calculateFresnel(viewDir, normal, uRefractiveIndex);

  // 计算基础光照
  vec3 lightColor = vec3(1.0, 0.0, 0.0); // 白光
  vec3 litColor = calculateBlinnPhong(lightDir, viewDir, normal, lightColor, waterColor);

  // 环境反射
  vec3 reflectionColor = vec3(0.5, 0.7, 1.0); // 默认天空色
  if (uUseEnvironmentMap == 1) {
    vec3 reflectDir = reflect(-viewDir, normal);
    // 简单的球面映射（实际应该用立方体贴图）
    vec2 envCoord = vec2(atan(reflectDir.z, reflectDir.x) / (2.0 * 3.14159) + 0.5, acos(reflectDir.y) / 3.14159);
    reflectionColor = texture2D(uEnvironmentMap, envCoord).rgb;
  }

  // 计算泡沫
  float foam = calculateFoam(vWaveHeight, normal);
  vec3 foamColor = vec3(1.0); // 白色泡沫

  // 混合所有效果
  vec3 finalColor = mix(litColor, reflectionColor, fresnel * uReflectance);
  finalColor = mix(finalColor, foamColor, foam * 0.3);

  // 添加一些动态的水面高光
  float sparkle = sin(vWorldPosition.x * 20.0 + uTime * 3.0) * cos(vWorldPosition.z * 15.0 + uTime * 2.0);
  sparkle = max(0.0, sparkle) * 0.1;
  finalColor += sparkle;

  // 输出最终颜色，包含透明度
  gl_FragColor = vec4(finalColor, uTransparency);
  // gl_FragColor = vec4(0.5, 0.3, 0.2, 1.0);
}
