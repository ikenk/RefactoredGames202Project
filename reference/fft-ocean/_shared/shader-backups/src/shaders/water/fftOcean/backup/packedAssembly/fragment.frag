#ifdef GL_ES
precision highp float;
#endif

// prettier-ignore
#extension GL_EXT_draw_buffers: enable

varying vec2 vTexCoord;

uniform sampler2D uPacked0;
uniform sampler2D uPacked1;
uniform sampler2D uPacked2;
uniform sampler2D uPacked3;

uniform vec2 uChoppiness;

// ---- foam 持久化 ----
uniform sampler2D uPrevDisplacement; // 上一帧 finalFBO 的 attachment 0
uniform float uFoamDecayRate; // 默认 0.05
uniform float uFoamAdd; // 默认 0.1
uniform float uFoamBias; // 默认 0.2
uniform float uFoamPower; // 默认 1.5

/**
 * Packed IFFT Assembly Pass
 *
 * 输入：4 个 packed IFFT 输出纹理（RG = 复数 Re/Im）
 *   uPacked0: height + i·dDz_dx    → (Dy, ∂Dz/∂x)
 *   uPacked1: dispX  + i·dispZ     → (Dx, Dz)
 *   uPacked2: slopeX + i·slopeZ    → (∂Dy/∂x, ∂Dy/∂z)
 *   uPacked3: dDx_dx + i·dDz_dz    → Jacobian 对角
 *
 * 输出 3 张纹理（MRT）：
 *   gl_FragData[0] = displacement  = (Dx·α, Dy, Dz·α, 0)   ← α = choppiness
 *   gl_FragData[1] = gradient      = (slopeX_corr, slopeZ_corr, 0, 0)
 *   gl_FragData[2] = jacobian      = (∂Dx/∂x, ∂Dz/∂z, ∂Dz/∂x, 0)
 *
 * 空域后处理：
 *   - choppiness 应用到水平位移
 *   - slope 修正：slope / (1 + |α·∂D/∂x|)（防止 chop 过大时法线异常）
 */

void main() {
  vec2 p0 = texture2D(uPacked0, vTexCoord).rg;
  vec2 p1 = texture2D(uPacked1, vTexCoord).rg;
  vec2 p2 = texture2D(uPacked2, vTexCoord).rg;
  vec2 p3 = texture2D(uPacked3, vTexCoord).rg;

  float Dy = p0.r;
  float dDz_dx = p0.g; // = ∂Dx/∂z

  float Dx = p1.r;
  float Dz = p1.g;

  float slopeX = p2.r; // ∂Dy/∂x
  float slopeZ = p2.g; // ∂Dy/∂z

  float dDx_dx = p3.r;
  float dDz_dz = p3.g;

  // 水平位移使用 choppiness
  float finalDx = Dx * uChoppiness.x;
  float finalDz = Dz * uChoppiness.y;

  // ---- slope 修正：slope / (1 + |α·∂D/∂x|) ----
  // float slopeX_corr = slopeX / (1.0 + abs(uChoppiness.x * dDx_dx));
  // float slopeZ_corr = slopeZ / (1.0 + abs(uChoppiness.y * dDz_dz));
  // ---- slope 修正：slope / (1 + α·∂D/∂x) ----
  /**
 * 显示网格 XZ 本身偏移，取原 IFFT(x,z) 高度
 * 即 h_display = h_IFFT(x,z), x_vertex = x + χ Dx, z_vertex = z + χ Dz
 * 欧拉斜率公式(x轴)
 * ∂h_display/∂x_vertex = ∂h/∂x * ∂x/∂x_vertex + ∂h/∂z * ∂z/∂x_vertex
 * 假设 ∂z/∂x_vertex ≈ 0，得到: ∂h_display/∂x_vertex ≈ ∂h/∂x / (1 + χ ∂Dx/∂x)
 * 即 slopeX / (1 + χ·∂Dx/∂α)
 */
  // 在折叠区域 (Jacobian < 0) 分母自然变负，slope 会翻向——这是物理正确的。
  float denomX = 1.0 + uChoppiness.x * dDx_dx;
  float denomZ = 1.0 + uChoppiness.y * dDz_dz;
  // 为防 0 除，clamp 下界到一个小正数（或允许翻负，看上层 foam 是否覆盖）
  float slopeX_corr = slopeX / max(denomX, 0.01); // 或者直接 / denomX 配合 foam 遮丑
  float slopeZ_corr = slopeZ / max(denomZ, 0.01);
  // float slopeX_corr = slopeX / denomX;
  // float slopeZ_corr = slopeZ / denomZ;

  // ---- jacobian 矩阵 ----
  // J = (1 + α·∂Dx/∂x) · (1 + β·∂Dz/∂z) - α·β·(∂Dz/∂x)²
  float dDx_dz = dDz_dx;
  float jacobian =
    (1.0 + uChoppiness.x * dDx_dx) * (1.0 + uChoppiness.y * dDz_dz) - uChoppiness.x * uChoppiness.y * (dDz_dx * dDx_dz);

  // ---- Foam 累积 ----
  float jClamped = pow(clamp(jacobian, 0.0, 1.0), uFoamPower);
  float biased = max(0.0, -(jClamped - uFoamBias));
  float prevFoam = texture2D(uPrevDisplacement, vTexCoord).a;
  float foam = clamp(prevFoam * exp(-uFoamDecayRate) + uFoamAdd * biased, 0.0, 1.0);
  // 历史快速衰减（每帧乘 0.6 ≈ 0.5s 内衰到 1%），同时当前 fold 强写入
  // float foam = clamp(max(prevFoam * 0.6, biased * 3.0), 0.0, 1.0);
  // float foam = clamp(biased * 5.0, 0.0, 1.0); // 没有 prevFoam，没有 decay

  // ---- 输出 ----
  // attachment 0 = displacement (xyz) + foam (w)
  gl_FragData[0] = vec4(finalDx, Dy, finalDz, foam);
  // attachment 1 = gradient
  gl_FragData[1] = vec4(slopeX_corr, slopeZ_corr, 0.0, 0.0);
  // attachment 2 = derivatives (留下原始 jacobian 供调试)
  gl_FragData[2] = vec4(dDx_dx, dDz_dz, dDz_dx, jacobian);

}
