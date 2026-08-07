/**
 * FFT Stockham — 2D Fragment Shader (多通道 MRT)
 *
 * 算法：
 *   一次 2D FFT = 先在水平方向做 N 次 1D FFT，再在垂直方向做 N 次 1D FFT；
 *   每个方向都跑 log₂N 个 Stockham stage，stage 之间通过 ping-pong FBO 传递。
 *   uDirection 切换处理水平 / 垂直；uSubtransformSize 控制当前 stage。
 *
 * MRT 设计（最多 4 通道同时蝶形）：
 *   uInputTexture0..3       每张是一个 packed 复数序列（RG = Re/Im）
 *   gl_FragData[0..3]       同步写出本 stage 的复数结果
 *   uNumChannels            实际使用的通道数（1–4），未启用的通道跳过 IO
 *   配合 realtimeSpectrum/fragment.frag 产生的 4 张 packed 谱:
 *     pack0 = height + i·dDz_dx
 *     pack1 = dispX  + i·dispZ
 *     pack2 = slopeX + i·slopeZ
 *     pack3 = dDx_dx + i·dDz_dz
 *
 * 数学模型：
 *   2D DFT     X[k,l] = Σ_{n,m} x[n,m] · W_N^{kn} · W_N^{lm}
 *   2D IDFT    x[n,m] = (1/N²) · Σ_{k,l} X[k,l] · W_N^{-kn} · W_N^{-lm}
 *   Stockham 蝶形（沿当前方向）
 *              Y[i] = x_even[i] + W_{sub}^{k} · x_odd[i]   k = i mod sub
 *
 * Final-stage（uFinalStage = true，目前未使用）：
 *   逆变换在所有 stage 结束后，理论结果应为实数（输入谱共轭对称 → 实信号）。
 *   通过 |Im| < eps 校验对称性，再选择性写 (Re, 0, 0, 1) 替代 (Re, Im, 0, 1)。
 *   1/N² 归一化在此可加，但本管线把它折进 RealtimeSpectrum 的 Δk = 2π/L 缩放，
 *   所以这里 *不再* 乘 1/N²，避免双重归一化。
 *
 * 注意：当前生产路径(FFTOceanComputePass-multi-layers-v3) 总是把
 *   uFinalStage 设为 0，让最后一 stage 也输出复数（Im≈0），由下游 assembly
 *   pass 只取 .r 通道。final-stage 路径仅用于调试。
 */

#ifdef GL_ES
precision highp float;
#endif

// prettier-ignore
#extension GL_EXT_draw_buffers: enable

// ============================================================
// Uniforms
// ============================================================

// ---- 多输入纹理（最多 4 个，packed 复数 RG = Re/Im）----
// 旧版只用 uInputTexture（单通道）走通了正确性；现在统一走 0..3 的 MRT 路径。
// uniform sampler2D uInputTexture;
uniform sampler2D uInputTexture0;
uniform sampler2D uInputTexture1;
uniform sampler2D uInputTexture2;
uniform sampler2D uInputTexture3;

uniform int uNumChannels; // 实际激活的通道数 ∈ [1, 4]
uniform int uSubtransformSize; // 当前 stage 的 subtransform 大小 sub: 2, 4, ..., N
uniform int uTransformSize; // 总 FFT 大小 N（2 的幂）
uniform int uInverse; // 0 = 正变换；1 = 逆变换
uniform int uDirection; // 0 = 水平方向 stage；1 = 垂直方向 stage
uniform bool uFinalStage; // 是否最后一 stage（决定要不要做共轭对称校验/取实部）

varying vec2 vTexCoord;

#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307

// ============================================================
// 复数工具
// ============================================================

/**
 * 复数乘法 (a.x + i·a.y) · (b.x + i·b.y)
 *
 * 数学：(a + ib)(c + id) = (ac − bd) + i(ad + bc)
 *
 * @param a  复数 a = a.x + i·a.y
 * @param b  复数 b = b.x + i·b.y
 * @return   a·b 的 (Re, Im)
 */
vec2 complexMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// ============================================================
// 主体：Stockham 二维蝶形（每帧调用 2·log₂N 次）
// ============================================================

void main() {
  // ---- 1) 由 UV 算当前方向的输出索引 ----
  // outputIndex ∈ [0, N)，取像素中心：floor(uv · N)
  // uDirection = 0：沿 X 轴扫，行内蝶形；uDirection = 1：沿 Y 轴扫，列内蝶形
  float outputIndex;
  if (uDirection == 0) {
    // 水平方向：处理当前行
    // outputIndex = vTexCoord.x * float(uTransformSize) - 0.5;
    outputIndex = floor(vTexCoord.x * float(uTransformSize));
  } else {
    // 垂直方向：处理当前列
    // outputIndex = vTexCoord.y * float(uTransformSize) - 0.5;
    outputIndex = floor(vTexCoord.y * float(uTransformSize));
  }

  // ---- 2) Stockham 重排：算 even / odd 的输入索引 ----
  //   evenIndex = ⌊outputIndex / sub⌋ · (sub/2) + (outputIndex mod (sub/2))
  //   oddIndex  = evenIndex + N/2
  // 上一 stage 写出的"前半 even、后半 odd"布局允许原地复用，避免位反序
  float halfSubSize = float(uSubtransformSize) * 0.5;
  float evenIndex = floor(outputIndex / float(uSubtransformSize)) * halfSubSize + mod(outputIndex, halfSubSize);

  // ---- 3) 算 even / odd 的采样 UV（按方向锁住正交轴）----
  // 采样保持像素中心 (i + 0.5)/N 以避开线性插值误差
  vec2 evenCoord, oddCoord;
  if (uDirection == 0) {
    // 水平：行内移动，Y 不变
    float evenU = (evenIndex + 0.5) / float(uTransformSize);
    float oddU = (evenIndex + float(uTransformSize) * 0.5 + 0.5) / float(uTransformSize);

    evenCoord = vec2(evenU, vTexCoord.y);
    oddCoord = vec2(oddU, vTexCoord.y);
  } else {
    // 垂直：列内移动，X 不变
    float evenV = (evenIndex + 0.5) / float(uTransformSize);
    float oddV = (evenIndex + float(uTransformSize) * 0.5 + 0.5) / float(uTransformSize);

    evenCoord = vec2(vTexCoord.x, evenV);
    oddCoord = vec2(vTexCoord.x, oddV);
  }

  // ---- 4) 旋转因子 W_sub^k ----
  // k = outputIndex mod sub（本子变换内的频率索引）
  // angle = sign · 2π · k / sub；sign = +1 (IDFT) / −1 (DFT)
  float sign = uInverse == 1 ? 1.0 : -1.0;
  float k = mod(outputIndex, float(uSubtransformSize));
  // W_n^k = e^(sign * 2πi * k / n)
  float angle = sign * TWO_PI * k / float(uSubtransformSize);
  vec2 twiddle = vec2(cos(angle), sin(angle));

  // ---- 5) 多通道并行蝶形：output_c = even_c + W · odd_c ----
  // 未启用的通道直接跳过 IO（少几次 texture fetch）
  vec2 result0 = vec2(0.0, 0.0);
  vec2 result1 = vec2(0.0, 0.0);
  vec2 result2 = vec2(0.0, 0.0);
  vec2 result3 = vec2(0.0, 0.0);

  // Channel 0（必有）
  vec2 even0 = texture2D(uInputTexture0, evenCoord).rg;
  vec2 odd0 = texture2D(uInputTexture0, oddCoord).rg;
  result0 = even0 + complexMul(twiddle, odd0);
  gl_FragData[0] = vec4(result0, 0.0, 1.0);

  // Channel 1
  if (uNumChannels >= 2) {
    vec2 even1 = texture2D(uInputTexture1, evenCoord).rg;
    vec2 odd1 = texture2D(uInputTexture1, oddCoord).rg;
    result1 = even1 + complexMul(twiddle, odd1);
    gl_FragData[1] = vec4(result1, 0.0, 1.0);
  }

  // Channel 2
  if (uNumChannels >= 3) {
    vec2 even2 = texture2D(uInputTexture2, evenCoord).rg;
    vec2 odd2 = texture2D(uInputTexture2, oddCoord).rg;
    result2 = even2 + complexMul(twiddle, odd2);
    gl_FragData[2] = vec4(result2, 0.0, 1.0);
  }

  // Channel 3
  if (uNumChannels >= 4) {
    vec2 even3 = texture2D(uInputTexture3, evenCoord).rg;
    vec2 odd3 = texture2D(uInputTexture3, oddCoord).rg;
    result3 = even3 + complexMul(twiddle, odd3);
    gl_FragData[3] = vec4(result3, 0.0, 1.0);
  }

  // ---- 6) Final stage（可选）：共轭对称校验 + 取实部 ----
  // 物理：输入谱 h(k,t) 满足 h(-k) = conj(h(k))（Hermitian 共轭对称），
  //       IDFT 后的空域信号应当严格实数。若有非零虚部，意味着上游谱不对称。
  // 数值：浮点 round-off 让 Im 不会严格 0，用 eps = 1e-3 做软判定。
  // 归一化：传统定义里 IDFT 需乘 1/N²；但本管线已把 1/N² 折进 RealtimeSpectrum
  //         的 Δk = 2π/L 缩放（参 Tessendorf η(x) = Σ h̃(k)·e^{ikx}），所以这里
  //         不再乘 scale，否则会双重归一化。
  if (uFinalStage) {
    float eps = 1e-3;
    bool valid = abs(result0.g) < eps && abs(result1.g) < eps && abs(result2.g) < eps && abs(result3.g) < eps;

    if (!valid) {
      // 上游谱不共轭对称（理论上不该发生），写黑像素便于可视化定位 bug
      gl_FragData[0] = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      // 4 通道实部打成一张 RGBA 输出（assembly pass 直接消费）
      vec4 result = vec4(result0.r, result1.r, result2.r, result3.r);
      // float scale = 1.0 / (float(uTransformSize) * float(uTransformSize));
      // result *= scale;   // ← 见上方"归一化"说明，故意不开
      gl_FragData[0] = result;
    }

    // if (abs(result2.g) > 0.01) {
    //   // 存在虚部 => 不共轭对称
    //   gl_FragData[0] = vec4(0.0, 1.0, 0.0, 1.0);
    // } else {
    //   // IFFT 归一化参数
    //   float scale = 1.0 / (float(uTransformSize) * float(uTransformSize));
    //   vec4 result = vec4(result0.r, result1.r, result2.r, result3.r);
    //   result *= scale;
    //   gl_FragData[0] = result;
    // }

    // if (abs(result2.g) > 0.01) {
    //   // 存在虚部 => 不共轭对称
    //   gl_FragData[0] = vec4(0.0, 1.0, 0.0, 1.0);
    // } else {
    //   // IFFT 归一化参数
    //   float scale = 1.0 / (float(uTransformSize) * float(uTransformSize));
    //   vec4 result = vec4(result0.r, result1.r, result2.r, result3.r);
    //   result *= scale;
    //   gl_FragData[0] = result;
    // }

  }

  // gl_FragColor = vec4(result,0.0,1.0);

}

// ============================================================
// 备份实现（历史 / 调试用，未参与编译路径）
//   早期单输入纹理 (uInputTexture) 的 main，保留以便对照新 MRT 路径
//   的正确性。要启用时取消注释，并把上面 main 注掉。
// ============================================================

// void main() {
//   // ✅ 1. 修正：直接计算像素索引（整数）
//   float outputIndex;
//   if (uDirection == 0) {
//     // 水平方向
//     outputIndex = floor(vTexCoord.x * float(uTransformSize));
//   } else {
//     // 垂直方向
//     outputIndex = floor(vTexCoord.y * float(uTransformSize));
//   }

//   // ✅ 2. Stockham 索引计算
//   float halfSubSize = float(uSubtransformSize) / 2.0;

//   // evenIndex = (outputIndex / subtransformSize) * halfSubSize + (outputIndex % halfSubSize)
//   float groupIndex = floor(outputIndex / float(uSubtransformSize));
//   float indexInGroup = mod(outputIndex, halfSubSize);
//   float evenIndex = groupIndex * halfSubSize + indexInGroup;

//   // oddIndex 在输入序列的后半部分
//   float oddIndex = evenIndex + float(uTransformSize) / 2.0;

//   // ✅ 3. 计算纹理坐标（像素中心）
//   vec2 even, odd;

//   if (uDirection == 0) {
//     // 水平FFT
//     float evenU = (evenIndex + 0.5) / float(uTransformSize);
//     float oddU = (oddIndex + 0.5) / float(uTransformSize);

//     even = texture2D(uInputTexture, vec2(evenU, vTexCoord.y)).rg;
//     odd = texture2D(uInputTexture, vec2(oddU, vTexCoord.y)).rg;
//   } else {
//     // 垂直FFT
//     float evenV = (evenIndex + 0.5) / float(uTransformSize);
//     float oddV = (oddIndex + 0.5) / float(uTransformSize);

//     even = texture2D(uInputTexture, vec2(vTexCoord.x, evenV)).rg;
//     odd = texture2D(uInputTexture, vec2(vTexCoord.x, oddV)).rg;
//   }

//   // ✅ 4. 计算旋转因子（修正符号）
//   float sign = uInverse == 1 ? 1.0 : -1.0;

//   // k = outputIndex % subtransformSize
//   float k = mod(outputIndex, float(uSubtransformSize));

//   // W_n^k = e^(sign * 2πi * k / n)
//   float angle = sign * TWO_PI * k / float(uSubtransformSize);
//   vec2 twiddle = vec2(cos(angle), sin(angle));

//   // ✅ 5. 蝶形运算
//   vec2 result = even + complexMul(twiddle, odd);

//   gl_FragColor = vec4(twiddle, 0.0, 1.0);
//   // gl_FragColor = vec4(20.0, 10.0, 0.0, 1.0);
// }

