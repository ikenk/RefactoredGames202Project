attribute vec3 aVertexPosition;
// attribute vec3 aNormalPosition;
attribute vec2 aTextureCoord;

// MVP 矩阵
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

uniform float uGeometrySize; // 海面网格 mesh 的大小，不是分辨率（网格数）
uniform float uTextureSize; // texture 的大小（实则是 spectrum 的分辨率）

uniform float uMagnificationXZ; // 水平位移放大系数
uniform float uMagnificationY; // 垂直位移放大系数

// 水深模型参数 -- 暂时不考虑
// uniform int uDepthModel; // 深度模型类型：0=平坦, 1=坡度, 2=径向, 3=复合
// uniform float uMaxDepth; // 最大深度
// uniform float uMinDepth; // 最小深度（海岸线）
// uniform vec2 uDepthCenter; // 深度中心点
// uniform float uDepthFalloff; // 深度衰减系数

// 位移/法向纹理贴图
uniform sampler2D uDisplacementMap; // IFFT 生成的位移贴图
uniform sampler2D uGradientMap; // IFFT 生成的梯度贴图
uniform sampler2D uDispDerivativeMap; // IFFT 生成的位移导数贴图

// 传入 Fragment 中的 Varying
varying vec3 vWorldPosition;
varying vec2 vTexCoord;
// 放到 fragment shader 做
varying vec3 vNormal;
// varying float vWaveHeight;
// varying float vWaterDepth;
// varying float vFoam; // 泡沫因子

/**
 * 地形的数学模型） -- 暂时不考虑
 *
 * 模型类型：
 * 0 - 平坦海底：固定深度
 * 1 - 坡度模型：线性坡度 depth = minDepth + slope * distance
 * 2 - 径向模型：以中心为最深点的径向衰减
 * 3 - 复合模型：结合多种地形特征
 */
// float calculateWaterDepth(vec2 position, int depthModel) {
//   // 计算相对于深度中心的位置
//   vec2 relativePos = position - uDepthCenter;
//   float distanceFromCenter = length(relativePos);

//   if (depthModel == 0) {
//     // === 模型0：平坦海底 ===
//     return uMaxDepth;

//   } else if (depthModel == 1) {
//     // === 模型1：简单坡度模型 ===
//     // 基于x坐标的线性坡度（模拟海岸线到深海的过渡）
//     float normalizedX = (position.x + 400.0) / 800.0; // 归一化到[0,1]
//     return mix(uMinDepth, uMaxDepth, normalizedX);

//   } else if (depthModel == 2) {
//     // === 模型2：径向深度模型 ===
//     // 中心最深，向边缘变浅（模拟海盆或湖泊）
//     float maxDistance = 400.0 * sqrt(2.0); // 对角线距离
//     float normalizedDistance = clamp(distanceFromCenter / maxDistance, 0.0, 1.0);

//     // 使用指数函数模拟真实的深度分布
//     float depthFactor = 1.0 - pow(normalizedDistance, uDepthFalloff);
//     return uMinDepth + (uMaxDepth - uMinDepth) * depthFactor;

//   } else if (depthModel == 3) {
//     // === 模型3：复合地形模型 ===
//     // 结合坡度和径向特征，模拟真实海洋地形

//     // 基础径向深度
//     float maxDistance = 600.0; // 调整影响范围
//     float normalizedDistance = clamp(distanceFromCenter / maxDistance, 0.0, 1.0);
//     float radialDepth = uMinDepth + (uMaxDepth - uMinDepth) * (1.0 - pow(normalizedDistance, 2.0));

//     // 添加方向性坡度（模拟大陆架）
//     float slopeInfluence = (position.x + 400.0) / 800.0; // x方向坡度
//     float slopeDepth = mix(uMinDepth * 0.5, uMaxDepth * 1.2, slopeInfluence);

//     // 添加地形起伏（海底山脊、海沟）
//     float ridge1 = sin(position.x * 0.008 + position.y * 0.005) * 15.0;
//     float ridge2 = cos(position.y * 0.012 - position.x * 0.003) * 10.0;
//     float terrain = ridge1 + ridge2;

//     // 组合所有因素
//     float combinedDepth = mix(radialDepth, slopeDepth, 0.3) + terrain;

//     return clamp(combinedDepth, uMinDepth, uMaxDepth * 1.5);

//   } else {
//     // 默认返回平均深度
//     return (uMinDepth + uMaxDepth) * 0.5;
//   }
// }

void main() {
  // ==================== 在 model space 采样和处理位移 ====================
  // uDisplacementMap 中的位移参数是在 model space 下确定的，因此应该将采样、放大放在 model space 下进行，然后再进行 world space 的转换
  vec2 uv = aTextureCoord;
  vec3 displacement = texture2D(uDisplacementMap, uv).xyz;
  vec3 displaced = vec3(
    displacement.x * uMagnificationXZ,
    displacement.y * uMagnificationY,
    displacement.z * uMagnificationXZ
  );
  vec3 modelPos = aVertexPosition + displaced; // model space
  // ==================== 在 world space 处理坐标 ====================
  vec4 worldPos = uModelMatrix * vec4(modelPos, 1.0); // world space

  // 大尺度 + 小尺度各采一次
  // vec2 uv1 = (uModelMatrix * vec4(aVertexPosition, 1.0) / 256.0).xz;
  // vec2 uv2 = (uModelMatrix * vec4(aVertexPosition, 1.0) / 32.0).xz;
  // vec3 d1 = texture2D(uDisplacementMap, uv1).xyz;
  // vec3 d2 = texture2D(uDisplacementMap, uv2).xyz * 1.0;
  // vec3 d3 = d1 + d2;
  // vec3 modelPosition = aVertexPosition + d3; // model space
  // vec4 worldPos = uModelMatrix * vec4(modelPosition, 1.0); // world space

  // ==================== 计算法线 ====================
  vec2 slope = texture2D(uGradientMap, uv).xy;
  vec4 jacobianData = texture2D(uDispDerivativeMap, uv);
  float dDx_dx = jacobianData.r;
  float dDz_dz = jacobianData.g;
  float dDx_dz = jacobianData.b;
  float dDz_dx = jacobianData.a;
  // uMagnificationXZ 和 uMagnificationY 带来的放大问题
  dDx_dx *= uMagnificationXZ;
  dDz_dz *= uMagnificationXZ;
  dDx_dz *= uMagnificationXZ;
  dDz_dx *= uMagnificationXZ;
  slope *= uMagnificationY;

  // 原始平面上的点 (x, 0, z) 经过位移后变成: P(x,z) = (x + Dx(x,z),  Dy(x,z),  z + Dz(x,z))
  // 要求法线，需要两个切向量: ∂P/∂x = (1 + ∂Dx/∂x, ∂Dy/∂x, ∂Dz/∂x) = (1 + dDx_dx, slope.x, dDz_dx) 和 ∂P/∂z = (∂Dx/∂z, ∂Dy/∂z, 1 + ∂Dz/∂z) = (dDx_dz, slope.y, 1 + dDz_dz)
  vec3 tangentX = vec3(1.0 + dDx_dx, slope.x, dDz_dx); // = ∂P/∂x
  vec3 tangentZ = vec3(dDx_dz, slope.y, 1.0 + dDz_dz); // = ∂P/∂z
  vec3 normal = normalize(cross(tangentZ, tangentX)); // n = ∂P/∂z × ∂P/∂x
  // 方法二
  // vec2 gradient = vec2(slope.x / (1.0 + dDx_dx), slope.y / (1.0 + dDz_dz));
  // normal = normalize(vec3(-gradient.x, 1.0, -gradient.y));

  // ==================== 传递 varying ====================
  // 传递世界坐标
  vWorldPosition = worldPos.xyz;
  // 传递 uv 坐标
  vTexCoord = uv;
  // 放到 fragment shader 做
  // 传递法线坐标
  vNormal = normal;
  // 波浪高度
  // vWaveHeight = worldPos.y;
  // 水体深度
  // vWaterDepth = calculateWaterDepth(vWorldPosition.xz, uDepthModel);
  // 泡沫因子
  // float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;
  // vFoam = jacobian;

  gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
}

// void main() {
//   // Debug Code，简单的正弦波测试
//   vec3 pos = aVertexPosition;
//   pos.y = sin(pos.x * 0.1 + uTime) * sin(pos.z * 0.1 + uTime) * 5.0;
//   gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);
// }

