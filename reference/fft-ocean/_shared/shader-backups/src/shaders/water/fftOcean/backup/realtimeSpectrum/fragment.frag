/**
 * Realtime Spectrum — Fragment Shader (GPU 时域演化 + 4 元打包)
 *
 * 取代 CPU 端 RealtimeSpectrum-v2.generateAtTime() 的实现。
 * 由 src/simulation/ocean/fft/RealtimeSpectrum-v2.ts 改编而来。
 *
 * 物理模型（Tessendorf 2001, sec. 4.3）：
 *   线性深水频散关系  ω(k) = sqrt(g · |k|)
 *   时域复振幅        h̃(k, t) = h̃₀(k) · e^{+iωt}  +  h̃₀*(−k) · e^{−iωt}
 *   保证空域结果实数 ↔ h̃(k, t) 共轭对称
 *
 * 数学（关于 ω·t 的复指数）：
 *   令 c = cos(ωt), s = sin(ωt)；记 h̃₀ = (h0r, h0i)，h̃₀(−k)* = (h0cr, h0ci)
 *   h̃(k, t).Re = h0r·c − h0i·s + h0cr·c + h0ci·s
 *   h̃(k, t).Im = h0r·s + h0i·c − h0cr·s + h0ci·c
 *
 * 4 张 packed 复数输出（MRT，与下游 FFTStockham2D 多通道路径对齐）：
 *   gl_FragData[0] pack0 = height + i·dDz_dx     →  IFFT 后取 (Re, Im) 重建 (Dy, ∂Dx/∂z)
 *   gl_FragData[1] pack1 = dispX  + i·dispZ      →  (Dx, Dz)
 *   gl_FragData[2] pack2 = slopeX + i·slopeZ     →  (∂Dy/∂x, ∂Dy/∂z)
 *   gl_FragData[3] pack3 = dDx_dx + i·dDz_dz     →  Jacobian 对角元 (∂Dx/∂x, ∂Dz/∂z)
 *
 * 频域 → 空域 微分算子（用频域乘以 i·k 等价空域 ∂/∂x）：
 *   disp.x = -i · k.x / |k| · h̃         （Tessendorf eq. 29）
 *   disp.z = -i · k.z / |k| · h̃
 *   slope.x = i · k.x · h̃                ←  ∂η/∂x
 *   slope.z = i · k.z · h̃
 *   ∂Dx/∂x = i · k.x · disp.x
 *   ∂Dz/∂z = i · k.z · disp.z
 *   ∂Dx/∂z = ∂Dz/∂x = i · k.x · disp.z   ←  Tessendorf 的对称性，下游 Jacobian 复用
 *
 * 轴向约定（与 FFTStockham2D.frag 一致；详见 Debug-Claude.md）：
 *   vTexCoord.x ↔ m（列）→ kx                     ← 已修复后的正确约定
 *   vTexCoord.y ↔ n（行）→ kz
 *   FFT-shift： n ∈ [0, N/2) 视作 +index；n ∈ [N/2, N) 视作 (n − N)
 *
 * I/O：
 *   uH0     RGBA Float32，RG = h̃₀(k) 的 (Re, Im)
 *   uH0Conj RGBA Float32，RG = h̃₀(−k)* 的 (Re, Im)
 *   uL      物理波长 [m]，单层 FFT 域大小（详见 Tessendorf "patch size"）
 *   uN      FFT 分辨率 N（2 的幂），无量纲
 *   uHalfN  = N / 2，用于 FFT-shift
 *   uTime   累计时间 t [s]
 *   uGravity 重力加速度 g ≈ 9.81 [m/s²]
 */

#ifdef GL_ES
precision highp float;
#endif

// prettier-ignore
#extension GL_EXT_draw_buffers: enable

varying vec2 vTexCoord;

uniform sampler2D uH0; // h̃₀(k)        RG = Re/Im
uniform sampler2D uH0Conj; // h̃₀(-k)*      RG = Re/Im

uniform float uL; // FFT Ocean Size, FFT 域物理尺寸 L [m]
uniform float uN; // FFT Resolution, FFT 分辨率 N（2 的幂）
uniform float uHalfN; // = N / 2

uniform float uTime; // 累计时间 t [s]
uniform float uGravity; // 重力加速度 g ≈ 9.81 [m/s²]

#define TWO_PI 6.283185307179586

void main() {
  float n = floor(vTexCoord.y * uN); // n ← texture Y 轴
  float m = floor(vTexCoord.x * uN); // m ← texture X 轴

  // FFT-shift：[0, N/2) → +idx；[N/2, N) → idx - N
  float nIdx = n < uHalfN ? n : n - uN;
  float mIdx = m < uHalfN ? m : m - uN;

  // kx 对应 Texture Y 轴，kz 对应 Texture X 轴（详见 Debug-Claude.md）
  // CPU 端计算
  // const kx = this.waveNumber(n)
  // const kz = this.waveNumber(m)
  // GPU 端计算
  // float kx = TWO_PI * nIdx / uL;
  // float kz = TWO_PI * mIdx / uL;

  // kx 对应 Texture X 轴，kz 对应 Texture Y 轴（详见 Debug-Claude.md）
  // CPU 端计算
  // const kx = this.waveNumber(m)
  // const kz = this.waveNumber(n)
  // GPU 端计算
  float kx = TWO_PI * mIdx / uL; // kx 由 n 算（沿 X 轴）← 标准约定
  float kz = TWO_PI * nIdx / uL; // kz 由 m 算（沿 Y 轴）

  float kLength = sqrt(kx * kx + kz * kz);

  // ---- h(k,t) = h0·e^{iωt} + conj(h0(-k))·e^{-iωt} ----
  float omega = sqrt(uGravity * kLength);
  float cosWt = cos(omega * uTime);
  float sinWt = sin(omega * uTime);

  vec2 h0 = texture2D(uH0, vTexCoord).rg;
  vec2 h0Conj = texture2D(uH0Conj, vTexCoord).rg;
  float h0r = h0.r;
  float h0i = h0.g;
  float h0cr = h0Conj.r;
  float h0ci = h0Conj.g;

  float hr = h0r * cosWt - h0i * sinWt + (h0cr * cosWt + h0ci * sinWt);
  float hi = h0r * sinWt + h0i * cosWt + (-h0cr * sinWt + h0ci * cosWt);

  float heightR = hr,
    heightI = hi;
  float dxR = 0.0,
    dxI = 0.0,
    dzR = 0.0,
    dzI = 0.0;
  float slopeXR = 0.0,
    slopeXI = 0.0,
    slopeZR = 0.0,
    slopeZI = 0.0;
  float dDxdxR = 0.0,
    dDxdxI = 0.0,
    dDzdzR = 0.0,
    dDzdzI = 0.0;
  float dDzdxR = 0.0,
    dDzdxI = 0.0;

  if (kLength > 0.0001 && kLength < 10000.0) {
    float kxn = kx / kLength;
    float kzn = kz / kLength;

    dxR = -hi * kxn;
    dxI = hr * kxn;
    dzR = -hi * kzn;
    dzI = hr * kzn;

    // 梯度谱 slope = i·h·k → slopeX = -hi·kx + i·hr·kx
    slopeXR = -hi * kx;
    slopeXI = hr * kx;
    slopeZR = -hi * kz;
    slopeZI = hr * kz;

    // Jacobian 对角 ∂Dx/∂x = i·k.x·dispX = (-dxI·kx) + i·(dxR·kx)
    dDxdxR = -dxI * kx;
    dDxdxI = dxR * kx;
    dDzdzR = -dzI * kz;
    dDzdzI = dzR * kz;
    // 非对角 ∂Dz/∂x = ∂Dx/∂z = i·k.x·dispZ = (-dzI·kx) + i·(dzR·kx)
    dDzdxR = -dzI * kx;
    dDzdxI = dzR * kx;
  }

  gl_FragData[0] = vec4(heightR - dDzdxI, heightI + dDzdxR, 0.0, 0.0); // pack0
  gl_FragData[1] = vec4(dxR - dzI, dxI + dzR, 0.0, 0.0); // pack1
  gl_FragData[2] = vec4(slopeXR - slopeZI, slopeXI + slopeZR, 0.0, 0.0); // pack2
  gl_FragData[3] = vec4(dDxdxR - dDzdzI, dDxdxI + dDzdzR, 0.0, 0.0); // pack3
}
