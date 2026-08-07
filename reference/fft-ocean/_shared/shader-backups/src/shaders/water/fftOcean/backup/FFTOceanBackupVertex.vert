attribute vec3 aVertexPosition;
// attribute vec3 aNormalPosition;
attribute vec2 aTextureCoord;

// MVP 矩阵
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// Debug Code
// uniform float uTime;

// 水深模型参数
uniform int uDepthModel; // 深度模型类型：0=平坦, 1=坡度, 2=径向, 3=复合
uniform float uMaxDepth; // 最大深度
uniform float uMinDepth; // 最小深度（海岸线）
uniform vec2 uDepthCenter; // 深度中心点
uniform float uDepthFalloff; // 深度衰减系数

// 位移/法向纹理贴图
uniform sampler2D uDisplacementMap; // IFFT 生成的位移贴图
uniform sampler2D uGradientMap; // IFFT 生成的梯度贴图
uniform sampler2D uDispDerivativeMap; // IFFT 生成的位移导数贴图

// 传入 Fragment 中的 Varying
varying vec3 vOriginalWorldPosition;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying float vFoam; // 泡沫因子
varying float vWaterDepth;
varying float vWaveHeight;

/**
 * 水深计算模型 （基于真实海洋地形的数学模型）
 *
 * 模型类型：
 * 0 - 平坦海底：固定深度
 * 1 - 坡度模型：线性坡度 depth = minDepth + slope * distance
 * 2 - 径向模型：以中心为最深点的径向衰减
 * 3 - 复合模型：结合多种地形特征
 */
float calculateWaterDepth(vec2 position, int depthModel) {
  // 计算相对于深度中心的位置
  vec2 relativePos = position - uDepthCenter;
  float distanceFromCenter = length(relativePos);

  if (depthModel == 0) {
    // === 模型0：平坦海底 ===
    return uMaxDepth;

  } else if (depthModel == 1) {
    // === 模型1：简单坡度模型 ===
    // 基于x坐标的线性坡度（模拟海岸线到深海的过渡）
    float normalizedX = (position.x + 400.0) / 800.0; // 归一化到[0,1]
    return mix(uMinDepth, uMaxDepth, normalizedX);

  } else if (depthModel == 2) {
    // === 模型2：径向深度模型 ===
    // 中心最深，向边缘变浅（模拟海盆或湖泊）
    float maxDistance = 400.0 * sqrt(2.0); // 对角线距离
    float normalizedDistance = clamp(distanceFromCenter / maxDistance, 0.0, 1.0);

    // 使用指数函数模拟真实的深度分布
    float depthFactor = 1.0 - pow(normalizedDistance, uDepthFalloff);
    return uMinDepth + (uMaxDepth - uMinDepth) * depthFactor;

  } else if (depthModel == 3) {
    // === 模型3：复合地形模型 ===
    // 结合坡度和径向特征，模拟真实海洋地形

    // 基础径向深度
    float maxDistance = 600.0; // 调整影响范围
    float normalizedDistance = clamp(distanceFromCenter / maxDistance, 0.0, 1.0);
    float radialDepth = uMinDepth + (uMaxDepth - uMinDepth) * (1.0 - pow(normalizedDistance, 2.0));

    // 添加方向性坡度（模拟大陆架）
    float slopeInfluence = (position.x + 400.0) / 800.0; // x方向坡度
    float slopeDepth = mix(uMinDepth * 0.5, uMaxDepth * 1.2, slopeInfluence);

    // 添加地形起伏（海底山脊、海沟）
    float ridge1 = sin(position.x * 0.008 + position.y * 0.005) * 15.0;
    float ridge2 = cos(position.y * 0.012 - position.x * 0.003) * 10.0;
    float terrain = ridge1 + ridge2;

    // 组合所有因素
    float combinedDepth = mix(radialDepth, slopeDepth, 0.3) + terrain;

    return clamp(combinedDepth, uMinDepth, uMaxDepth * 1.5);

  } else {
    // 默认返回平均深度
    return (uMinDepth + uMaxDepth) * 0.5;
  }
}

void main() {
  vTexCoord = aTextureCoord;
  // 计算原始世界坐标（未变形）
  vec4 originalWorldPos = uModelMatrix * vec4(aVertexPosition, 1.0);
  vOriginalWorldPosition = originalWorldPos.xyz;

  // 从纹理读取数据
  vec4 displacement = texture2D(uDisplacementMap, aTextureCoord);
  vec2 gradient = texture2D(uGradientMap, aTextureCoord).xy;

  // 应用位移
  vec3 displacedPos = aVertexPosition;
  displacedPos.xyz += displacement.xyz;

  // 世界坐标
  vec4 worldPos = uModelMatrix * vec4(displacedPos, 1.0);
  vWorldPosition = worldPos.xyz;
  // 波浪高度
  vWaveHeight = worldPos.y;

  /**
 * 计算法线
 * 如果模型矩阵 M 只包含旋转和平移（没有非均匀缩放、没有错切），就可以直接使用 uModelMatrix，因为旋转矩阵的逆就是转置，且它的转置 = 自身（正交矩阵）
 *  在大多数海面渲染中，网格是单位大小的平面，只做旋转和位置移动，所以直接用 mat3(uModelMatrix) 足够且更快。
 *  WebGL1.0 不支持 transpose 和 inverse，所以没办法在 Shader 中计算 transpose(inverse(uModelMatrix))
 */
  vNormal = normalize(mat3(uModelMatrix) * vec3(-gradient.x, 1.0, -gradient.y));

  // 水体深度
  vWaterDepth = calculateWaterDepth(displacedPos.xz, 0);

  // 传递泡沫因子（雅可比值）
  vFoam = displacement.w;

  gl_Position = uProjectionMatrix * uViewMatrix * worldPos;

  /**
 * Debug Code
 * 简单的正弦波测试
 */
  // vec3 pos = aVertexPosition;
  // pos.y = sin(pos.x * 0.1 + uTime) * sin(pos.z * 0.1 + uTime) * 5.0;
  // gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);

}
