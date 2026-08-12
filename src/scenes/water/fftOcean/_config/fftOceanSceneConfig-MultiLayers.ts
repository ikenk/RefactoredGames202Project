import { FFT_OCEAN_MATERIAL_DEFAULTS } from '@/materials/water/_config/defaults'
import { Transform } from '@/objects/utils/Transform'
import { FFTOceanConfig } from '../types/FFTOceanConfig-MultiLayers'
import { FFTOceanMaterialConfig } from '@/materials/water/types/FFTOceanMaterialConfig'

/**
 * FFTOceanScene（multi-layers / cascade=4）的场景配置。
 *
 * 文件分两段：
 *   1. FFT_OCEAN_MATERIAL_OVERRIDES — 仅覆盖 FFT_OCEAN_MATERIAL_DEFAULTS 中
 *      与"远洋海面"风格不一致的字段。其余字段沿用 defaults.ts 中的默认值。
 *      → 对应 shader：fragment-multi-layers.frag
 *      → 对应 material：FFTOceanMaterial-MultiLayers.ts
 *
 *   2. DEFAULT_FFT_OCEAN_CONFIG — 完整的 FFTOceanConfig：
 *      Mesh + Material + Renderer + FFT layer authoring config（4 层）。
 *      ⚠️ layers 的长度若 > 4，多余层会被 shader 忽略。
 *
 * 物理量单位约定：
 *   - 长度 / size / fetch：米
 *   - windSpeed：m/s（U10：海面上方 10 m 处的 1 小时均值）
 *   - windDirection：度（0° 沿 +X，逆时针为正；与 spectrum.frag 的 θ 一致）
 *   - amplitude / scale：无量纲艺术增益（频谱 √S(k) 的整体放大）
 *   - λ_peak ≈ U₁₀² / g (Pierson–Moskowitz 估计)，用于判断 fetch 是否落在 size 内
 */

// ============================================================
// 1) 材质覆盖：默认 + 远洋风格定制
// ============================================================
export const FFT_OCEAN_MATERIAL_OVERRIDES: FFTOceanMaterialConfig = {
  // ==================== Toggles ====================
  useEnvironmentMap: 1, // IBL specular（textureCubeLodEXT → 关时 envReflect = 0）
  useFoam: 1, // foam 末尾混色（关时只看 PBR 主体，debug specular aliasing 用）
  useFog: 1, // 大气透视（关时远场不会被 horizon 蓝灰染色）

  // ==================== Fresnel ====================
  refractiveIndex: 1.33, // η（海水）→ F0 = ((η-1)/(η+1))² ≈ 0.02

  // ==================== SSS (Subsurface Scattering)  ====================
  /**
   * SSS (Subsurface Scattering) 四项经验模型
   *   k1 = σ_peak · H · (L·-V)⁴ · (0.5 - 0.5·L·N)³   逆光波峰透光
   *   k2 = σ_view · (V·N)²                            视线垂直穿水
   *   k3 = σ_sh   · (N·L)                             类 Lambert
   *   k4 = ρ_amb                                      环境散射
   *
   * ── 经验配色表（线性空间）─────────────────────────────────────
   *  水域类型   | scatterColor       | scatterPeakColor    | 视觉效果
   *  ----------|---------------------|---------------------|----------
   *  深远洋    | [0.0,  0.05, 0.15] | [0.0,  0.25, 0.4]  | 黑蓝主体 + 蓝色透光
   *  中深海    | [0.0,  0.15, 0.35] | [0.1,  0.4,  0.55] | 深蓝主体 + 青蓝峰
   *  沿岸      | [0.05, 0.4,  0.5]  | [0.3,  0.7,  0.65] | 青绿主体 + 翠绿峰
   *  热带浅海  | [0.1,  0.6,  0.7]  | [0.4,  0.9,  0.8]  | 蓝绿主体 + 亮翠绿峰
   *
   * 经验规则：
   *   - scatterPeakColor 略偏绿（波尖薄、绿光吸收少），并比 scatterColor 亮
   *   - wavePeakScatterStrength 建议范围 0.3~5（依 H 而定）
   */
  // scatterColor: [0.0, 0.05, 0.15],
  // scatterPeakColor: [0.0, 0.25, 0.4],
  // 加少量 R，让蓝"有重量"而不是"塑料感"
  scatterPeakColor: [0.05, 0.22, 0.35],
  scatterColor: [0.02, 0.06, 0.14],
  wavePeakScatterStrength: 0.3, // σ_peak（k1）
  scatterStrength: 0.15, // σ_view（k2）
  scatterShadowStrength: 0.25, // σ_sh  （k3）
  ambientDensity: 0.01, // ρ_amb （k4），开了 IBL 后兜底权重可以非常小
  heightStrength: 1.0, // 波高缩放（H，给 SSS k1 用）

  // ==================== Cook-Torrance ====================
  roughness: 0.05, // Beckmann RMS 斜率 m（水非常光滑）
  foamRoughness: 0.9, // foam 覆盖处的 roughness 增量（接近 lambertian）

  // ==================== IBL ====================
  envirLightStrength: 0.8, // envReflect 艺术增益（HDR 解码 + tonemap 前曝光补偿）

  // ==================== 兜底环境色 ====================
  // IBL 关闭时给 SSS k4 用
  ambientColor: [0.3, 0.42, 0.55],

  // ==================== Foam ====================
  // scale 越大颗粒越细，但 tile 重复越明显（近距离会看到网格感）
  foamUVScale: 1.5, // uv = worldXZ · 1.5 → 单 tile ≈ 0.67 m
  foamColor: [0.85, 0.9, 0.95], // 微蓝白（模拟泡沫里残留的水色）

  // ==================== 阴影 ====================
  shadowIntensity: 0.2, // 软阴影 lift：S̃ = sat(shadow + 0.2)

  // ==================== 大气透视（fog）====================
  fogColor: [0.7, 0.78, 0.85], // horizon 蓝灰
  fogDensity: 0.004, // ≈ 1/256m，远场约 256 m 起有明显雾感
  fogPower: 3.0, // 1.0 = 标准 exp fog，>1 远雾更厚。调到 2.0~3.0，pow(d·density, power) 在 d 小时被压得更低（因为 <1 的数高次幂更小）→ 近处雾更淡、远处照样浓

  // ==================== 近/远法线过渡 ====================
  // calcSurfaceByLayerSize 中的 varMask
  varMaskRange: 1.0, // 远场过渡开始距离的总倍率（大 → 早开始）
  varMaskPower: 1.5, // 过渡曲线锐度（大 → S 形更陡）
  varMaskTexScale: 2.0, // disp0.y 当 hash 的 uv 缩放（控制斑块尺度）

  // ==================== 水深衰减 ====================
  displaceDepthAttenuation: 1.0,
  foamDepthAttenuation: 2.0,

  // ==================== 表面缩放 ====================
  normalStrength: 0.8 // slope 总闸（视觉粗糙感）
}

// ============================================================
// 2) 场景完整配置：Mesh + Material + Renderer + FFT cascade
// ============================================================
export const DEFAULT_FFT_OCEAN_CONFIG: FFTOceanConfig = {
  // ==================== Mesh ====================
  transform: new Transform([0, 0, 0], [0, 0, 0], [1, 1, 1]),
  surfaceSize: 256, // 屏幕上海面 mesh 的物理尺寸 [m]
  surfaceMeshResolution: 1024, // mesh 顶点密度（与 FFT 纹理分辨率独立）

  // ==================== Material ====================
  materialConfig: {
    ...FFT_OCEAN_MATERIAL_DEFAULTS,
    ...FFT_OCEAN_MATERIAL_OVERRIDES
  },

  // ==================== Renderer ====================
  renderingMode: 'MESH', // 'MESH'
  // renderingMode: LineRenderMode.LINES, //  LineRenderMode.LINES（debug 用）

  // ==================== FFT Calculate ====================
  /**
   * 4 层级联（cascade）的可编辑配置。
   *
   * 物理动机：单层 FFT 的 (size, fftResolution) 决定了它能表达的波长范围
   *   k_min ≈ 2π / size，k_max ≈ π · fftResolution / size。
   * 单层很难同时覆盖大涌浪（λ~100 m）和毛细波（λ~0.1 m），所以分 4 层：
   *
   *   Layer 0 (size=256) — 主涌浪 / swell        λ_peak ~ 60-100 m
   *   Layer 1 (size= 64) — 风浪 / wind sea       λ_peak ~ 15-30  m
   *   Layer 2 (size= 16) — 短波 / chop           λ_peak ~  2-6   m
   *   Layer 3 (size=  4) — 毛细波 / ripple       λ_peak ~  0.3-1 m
   *
   * 每层 evaluation.kMin/kMax 用于硬切窗口，避免跨层频率重复。
   * ⚠️ 若 layers.length > 4，多出的层仍会被当前 shader 忽略。
   */
  layers: [
    // ----- Layer 0：主涌浪 (size=256) -----
    {
      grid: {
        size: 256,
        fftResolution: 512
      },
      evaluation: {
        gravity: 9.81,
        depth: 1000,
        kMin: 0.025,
        kMax: 0.25
      },
      spectrum: {
        model: 'jonswap',
        primary: {
          scale: 0.75,
          windSpeed: 10,
          windDirection: 0,
          fetch: 150000,
          spreadBlend: 0.15,
          swell: 0.3,
          peakEnhancement: 3.3,
          shortWavesFade: 0.5
        },
        secondary: {
          scale: 0.75,
          windSpeed: 10,
          windDirection: 90,
          fetch: 100000,
          spreadBlend: 0.15,
          swell: 0.3,
          peakEnhancement: 3.3,
          shortWavesFade: 0.5
        }
      },
      initialSpectrum: {
        amplitude: 1.3
      },
      runtime: {
        choppiness: [1.2, 1.2],
        foamBias: 0.15,
        foamAdd: 0.07,
        foamDecayRate: 0.07,
        foamPower: 1.5
      },
      blend: {
        layerContribute: 0.95
      }
    },

    // ----- Layer 1：风浪 (size=64) -----
    {
      grid: {
        size: 64,
        fftResolution: 512
      },
      evaluation: {
        gravity: 9.81,
        depth: 1000,
        kMin: 0.001,
        kMax: 2.1
      },
      spectrum: {
        model: 'jonswap',
        primary: {
          scale: 0.65,
          windSpeed: 7,
          windDirection: 270,
          fetch: 50000,
          spreadBlend: 0.15,
          swell: 0,
          peakEnhancement: 3.3,
          shortWavesFade: 0.05
        },
        secondary: {
          scale: 0.65,
          windSpeed: 6,
          windDirection: 180,
          fetch: 60000,
          spreadBlend: 0.15,
          swell: 0,
          peakEnhancement: 3.3,
          shortWavesFade: 0.05
        }
      },
      initialSpectrum: {
        amplitude: 1.1
      },
      runtime: {
        choppiness: [1.9, 1.9],
        foamBias: 0.08,
        foamAdd: 0.08,
        foamDecayRate: 0.08,
        foamPower: 1.5
      },
      blend: {
        layerContribute: 0.75
      }
    },

    // ----- Layer 2：短波 / chop (size=16) -----
    {
      grid: {
        size: 16,
        fftResolution: 512
      },
      evaluation: {
        gravity: 9.81,
        depth: 1000,
        kMin: 0.025,
        kMax: 9
      },
      spectrum: {
        model: 'jonswap',
        primary: {
          scale: 0.6,
          windSpeed: 4.5,
          windDirection: 90,
          fetch: 2200,
          spreadBlend: 0.1,
          swell: 0.1,
          peakEnhancement: 3.3,
          shortWavesFade: 0.03
        },
        secondary: {
          scale: 0.3,
          windSpeed: 4,
          windDirection: 180,
          fetch: 1500,
          spreadBlend: 0.1,
          swell: 0.15,
          peakEnhancement: 3.3,
          shortWavesFade: 0.03
        }
      },
      initialSpectrum: {
        amplitude: 0.8
      },
      runtime: {
        choppiness: [2.3, 2.3],
        foamBias: 0.07,
        foamAdd: 0.03,
        foamDecayRate: 0.08,
        foamPower: 1.5
      },
      blend: {
        layerContribute: 0.6
      }
    },

    // ----- Layer 3：毛细波 / ripple (size=4) -----
    {
      grid: {
        size: 4,
        fftResolution: 512
      },
      evaluation: {
        gravity: 9.81,
        depth: 1000,
        kMin: 12.5,
        kMax: 45
      },
      spectrum: {
        model: 'jonswap',
        primary: {
          scale: 0.45,
          windSpeed: 3,
          windDirection: 135,
          fetch: 320,
          spreadBlend: 0.5,
          swell: 0.1,
          peakEnhancement: 3.3,
          shortWavesFade: 0.001
        },
        secondary: {
          scale: 0.15,
          windSpeed: 2.5,
          windDirection: 225,
          fetch: 220,
          spreadBlend: 0.5,
          swell: 0.08,
          peakEnhancement: 3.3,
          shortWavesFade: 0.001
        }
      },
      initialSpectrum: {
        amplitude: 0.7
      },
      runtime: {
        choppiness: [2.8, 2.8],
        foamBias: 0.1,
        foamAdd: 0,
        foamDecayRate: 0.05,
        foamPower: 1.5
      },
      blend: {
        layerContribute: 0.35
      }
    }
  ]
}
