import { Material } from '@/materials/Material'
import { UniformType, type Uniforms } from '@/materials/types/Material'
import type { FFTOceanMaterialConfig } from './types/FFTOceanMaterialConfig'
import type { FFTOceanLayerBlendConfig } from './types/FFTOceanLayerBlendConfig'
import { FFT_OCEAN_MATERIAL_DEFAULTS } from './_config/defaults'

export class FFTOceanMaterial extends Material {
  constructor(
    label: string,
    // oceanParamsCascade: OceanParams[],
    layerBlendConfigs: readonly FFTOceanLayerBlendConfig[],
    config: FFTOceanMaterialConfig = {}
  ) {
    const p: Required<FFTOceanMaterialConfig> = { ...FFT_OCEAN_MATERIAL_DEFAULTS, ...config }

    // console.debug(p)

    const uniforms: Uniforms = {
      // ============================================================
      // 1) 相机 / 光照（占位，由 ForwardRenderPass + LightSystem 每帧注入）
      //    V    = normalize(uCameraPos - vWorldPosition) --> 视线
      //    L    = uLightDir --> surface → light
      //    L_i  = uLightRadiance --> 光源辐射度
      // ------------------------------------------------------------
      //    注：uLightPos 在本 shader 中不使用（方向光不需要点位置；
      //         shadow map 还没接入，所以连阴影用都没有）→ 不声明。
      // ============================================================
      uCameraPos: { type: UniformType.THREE_FV, value: [0, 0, 0] },
      uLightDir: { type: UniformType.THREE_FV, value: [0, 1, 0] },
      uLightRadiance: { type: UniformType.THREE_FV, value: [1, 1, 1] },
      // uLightPos: { type: UniformType.THREE_FV, value: [0, 0, 0] },

      // ============================================================
      // 2) Toggles（int 0|1，shader 内用 == 1 判断；driver 通常会把
      //    分支两侧的死代码 DCE 掉，因此运行时几乎零开销）
      //
      //    uUseEnvironmentMap — 关闭 IBL specular（envReflect 直接返回 0）
      //    uUseFoam           — 关闭 foam mask 计算 + 贴图采样 + 末尾混色
      //                          （观察纯 PBR 海面、debug specular aliasing 用）
      //    uUseFog            — 关闭大气透视 fog 混色
      //                          （shader 里默认开启；远场颜色会偏向 uFogColor）
      // ============================================================
      uUseEnvironmentMap: { type: UniformType.ONE_I, value: p.useEnvironmentMap },
      uUseFoam: { type: UniformType.ONE_I, value: p.useFoam },
      uUseFog: { type: UniformType.ONE_I, value: p.useFog },

      // ============================================================
      // 3) IBL 资源（占位 → 由 loadFFTOceanScene 经 updateMaterialUniforms 注入）
      //    uPrefilteredEnvMap — GGX 重要性采样卷积后的 cubemap
      //                         mip-i ↔ roughness = i / (numMips - 1)
      //    uBRDFLUT           — 2D LUT，r=NdotV, v=roughness
      //                         RG = split-sum BRDF 积分的 (scale, bias)
      //    uMaxReflectionLod  = numMips - 1，作为采样 lod 的 clamp 上限
      // ============================================================
      uPrefilteredEnvMap: { type: UniformType.TEXTURE_CUBE, value: null },
      uBRDFLUT: { type: UniformType.TEXTURE_2D, value: null },
      uMaxReflectionLod: { type: UniformType.ONE_F, value: 5.0 },

      // ============================================================
      // 4) Fresnel / 兜底环境色
      //    uRefractiveIndex — η（水≈1.33）
      //                       → F0 = ((η - 1) / (η + 1))² ≈ 0.02
      //    uAmbientColor    — IBL 关闭时给 SSS k4 用的环境兜底色
      //                       （IBL 开启时被 prefiltered envmap 覆盖）
      // ============================================================
      uRefractiveIndex: { type: UniformType.ONE_F, value: p.refractiveIndex },
      uAmbientColor: { type: UniformType.THREE_FV, value: p.ambientColor },

      // ============================================================
      // 5) Cook-Torrance（Beckmann NDF + Smith Schlick mask）
      //
      //    BRDF：f_r = D · F · G / (4 · (n·l) · (n·v))
      //
      //    uRoughness     — 微表面 RMS 斜率 m ∈ [0, 1]，影响三项：
      //                       D: exp(-tan²θ_h / m²) / (π m² (n·h)⁴)
      //                       G: Λ(a) ≈ 有理逼近, a = (h·o)/(m · sin θ)
      //                       F: (1-n·v)^(5·e^(-2.69m)) / (1 + 22.7·m^1.5)
      //
      //    uFoamRoughness — foamMask=1 时叠加到 roughness 上的增量
      //                       roughness_eff = uRoughness + foamMask · uFoamRoughness
      //                       物理：泡沫=无数无序气泡 → 微表面取向高度无序 → m 增大
      // ============================================================
      uRoughness: { type: UniformType.ONE_F, value: p.roughness },
      uFoamRoughness: { type: UniformType.ONE_F, value: p.foamRoughness },

      // ============================================================
      // 6) Subsurface Scattering（4 项经验模型）
      //
      //    k1 = σ_peak · H · (L·-V)⁴ · (0.5 - 0.5·L·N)³        逆光波峰透光
      //    k2 = σ_view · (V·N)²                                视线垂直穿水
      //    k3 = σ_sh   · (N·L)                                 类 Lambert
      //    k4 = ρ_amb                                          环境散射
      //
      //    合成：
      //      scatter = (k1·C_peak + k2·C_scat) · L_i / (1 + Λ(l)) · S̃
      //             +  k3·C_scat · L_i · S̃
      //             +  k4·C_amb
      //
      //    uWavePeakScatterStrength — σ_peak  （k1）
      //    uScatterStrength         — σ_view  （k2）
      //    uScatterShadowStrength   — σ_sh    （k3）
      //    uAmbientDensity          — ρ_amb   （k4）
      //    uScatterColor            — C_scat  （k2/k3）
      //    uScatterPeakColor        — C_peak  （k1）
      //    uHeightStrength          — H 的缩放
      //    uShadowIntensity         — 软阴影 lift：S̃ = sat(shadow + lift)
      // ============================================================
      uWavePeakScatterStrength: { type: UniformType.ONE_F, value: p.wavePeakScatterStrength },
      uScatterStrength: { type: UniformType.ONE_F, value: p.scatterStrength },
      uScatterShadowStrength: { type: UniformType.ONE_F, value: p.scatterShadowStrength },
      uAmbientDensity: { type: UniformType.ONE_F, value: p.ambientDensity },
      uScatterColor: { type: UniformType.THREE_FV, value: p.scatterColor },
      uScatterPeakColor: { type: UniformType.THREE_FV, value: p.scatterPeakColor },
      uShadowIntensity: { type: UniformType.ONE_F, value: p.shadowIntensity },
      uHeightStrength: { type: UniformType.ONE_F, value: p.heightStrength },

      // ============================================================
      // 7) IBL specular 艺术增益（绕过物理）
      //    envReflect *= uEnvirLightStrength
      //    主要用于补偿 HDR 解码后亮度偏离与 tone-mapping 前的曝光
      // ============================================================
      uEnvirLightStrength: { type: UniformType.ONE_F, value: p.envirLightStrength },

      // ============================================================
      // 8) 法线缩放 / 远近衰减
      //    uNormalStrength            — slope 的缩放（视觉粗糙感的总闸）
      //    uDisplaceDepthAttenuation  — k1 与 nMeso → nMacro 在 vClipDepth → 0
      //                                  时的衰减曲线指数：
      //                                    factor = pow(vClipDepth, exp)
      // ============================================================
      uNormalStrength: { type: UniformType.ONE_F, value: p.normalStrength },
      uDisplaceDepthAttenuation: { type: UniformType.ONE_F, value: p.displaceDepthAttenuation },

      // ============================================================
      // 9) 远场法线 / 噪声 mask（calcSurfaceByLayerSize 中的 varMask）
      //
      //    invDepth = clamp(pow(dist / 500 · Range, Power), 0, 1)
      //    noise01  = uDisplacementMap0.y(worldXZ · 0.001 · TexScale) · 0.5 + 0.5
      //    varMask  = sat(noise01 · 4.0 · invDepth)
      //    finalSlope = mix(slopeAll, slopeHigh, varMask) · uNormalStrength
      //
      //    uVarMaskRange    — 远场过渡开始距离（值大→更早开始过渡）
      //    uVarMaskPower    — 过渡曲线锐度（值大→S 形更陡）
      //    uVarMaskTexScale — 用 disp0.y 当 hash 时的 uv 缩放（控制斑块尺度）
      // ============================================================
      uVarMaskRange: { type: UniformType.ONE_F, value: p.varMaskRange },
      uVarMaskPower: { type: UniformType.ONE_F, value: p.varMaskPower },
      uVarMaskTexScale: { type: UniformType.ONE_F, value: p.varMaskTexScale },

      // ============================================================
      // 10) Foam（颗粒贴图 + 颜色）
      //
      //    Jacobian < bias 在 compute pass 里写到 displacement.a；
      //    本 material 只负责"上色与混合"：
      //      foamMask  = Σ contribute_i · displacementMap_i.a
      //      foamUV    = vWorldXZ · uFoamUVScale
      //      foamLit   = uFoamMap(foamUV).rgb · uFoamColor · (L_i·NdotL + IBL_ambient)
      //      color    := mix(color, foamLit, foamMask)         (受 uUseFoam 控制)
      //
      //    uFoamMap     — 占位，scene 阶段注入 1K-PNG 灰阶/彩色颗粒
      //    uFoamUVScale — uv = worldXZ · scale；scale 越大颗粒越细。
      //                    经验：scale ∈ [0.1, 1.5]；颗粒物理尺度 ≈ 1/scale 米
      //                    ⚠️ 太大会出现 tile 网格感（详见 CHANGES.md）
      //    uFoamColor   — 染色（一般偏冷的微蓝白：[0.85, 0.9, 0.95]）
      // ============================================================
      uFoamMap: { type: UniformType.TEXTURE_2D, value: null },
      uFoamUVScale: { type: UniformType.ONE_F, value: p.foamUVScale },
      uFoamColor: { type: UniformType.THREE_FV, value: p.foamColor },

      // ============================================================
      // 11) Fog（atmospheric perspective，Beer-Lambert 简化形式）
      //
      //    factor = 1 - exp(-(dist · density)^power)
      //    color := mix(color, uFogColor, factor)              (受 uUseFog 控制)
      //
      //    uFogColor   — horizon 蓝灰（[0.7, 0.78, 0.85] 是个稳妥默认）
      //    uFogDensity — 单位 1/m；0.004 ≈ 1/256m 处出现明显雾感
      //    uFogPower   — 曲线弯曲度；1.0 = 标准 exp，>1 远雾更厚、近处更通透
      // ============================================================
      uFogColor: { type: UniformType.THREE_FV, value: p.fogColor },
      uFogDensity: { type: UniformType.ONE_F, value: p.fogDensity },
      uFogPower: { type: UniformType.ONE_F, value: p.fogPower }

      // ============================================================
      // 7 水深模型（目前 shader 未消费，保留兼容）
      // ============================================================
      // uDepthModel: { type: UniformType.ONE_I, value: p.depthModel },
      // uMaxDepth: { type: UniformType.ONE_F, value: p.maxDepth },
      // uMinDepth: { type: UniformType.ONE_F, value: p.minDepth },
      // uDepthCenter: { type: UniformType.TWO_FV, value: p.depthCenter },
      // uDepthFalloff: { type: UniformType.ONE_F, value: p.depthFalloff }

      // ============================================================
      // 3 纹理开关（int 0|1，shader 里用 == 1 判断）
      // ============================================================
      // uUseDiffuseMap: { type: UniformType.ONE_I, value: p.useDiffuseMap },
      // uUseNormalMap: { type: UniformType.ONE_I, value: p.useNormalMap },
      // uUseEnvironmentMap: { type: UniformType.ONE_I, value: p.useEnvironmentMap },

      // ============================================================
      // 4 基础贴图（按开关条件注入）
      //   uDiffuseMap      — 备用，本 shader 未使用
      //   uNormalMap       — 备用，法线由 FFT slope/jacobian 计算
      //   uEnvironmentMap  — 立方体贴图，供 textureCube(reflect(-V,N)) 采样
      //                     物理含义：环境辐射度 L_env(ω)，乘 Fresnel 参与最终输出
      // ============================================================
      // ---- 基础纹理（按开关条件注入） ----
      // ...(p.useDiffuseMap && p.diffuseMap
      //   ? { uDiffuseMap: { type: UniformType.TEXTURE_2D, value: p.diffuseMap } }
      //   : {}),
      // ...(p.useNormalMap && p.normalMap
      //   ? { uNormalMap: { type: UniformType.TEXTURE_2D, value: p.normalMap } }
      //   : {}),
      // ...(p.useEnvironmentMap && p.environmentMap
      //   ? { uEnvironmentMap: { type: UniformType.TEXTURE_CUBE, value: p.environmentMap } }
      //   : {}),
      // uDiffuseMap: {
      //   type: UniformType.TEXTURE_2D,
      //   value: p.useDiffuseMap && p.diffuseMap ? p.diffuseMap : null
      // },
      // uNormalMap: {
      //   type: UniformType.TEXTURE_2D,
      //   value: p.useNormalMap && p.normalMap ? p.normalMap : null
      // },
      // uEnvironmentMap: {
      //   type: UniformType.TEXTURE_CUBE,
      //   value: p.useEnvironmentMap && p.environmentMap ? p.environmentMap : null
      // },

      // ============================================================
      // 6 水体物理参数
      //   uTransparency     — 透明度 α，用于 gl_FragColor.a
      //   uReflectance      — 反射率缩放（艺术控制）
      //   uRefractiveIndex  — 折射率 η（海水≈1.33），参与 F0=((η-1)/(η+1))²
      // ============================================================
      // uTransparency: { type: UniformType.ONE_F, value: p.transparency },
      // uReflectance: { type: UniformType.ONE_F, value: p.reflectance },

      // ============================================================
      // 8 Cook-Torrance 参数
      //   uRoughness        — 微表面 RMS 斜率 m，参与
      //                       D: exp(−tan²θ_h/m²)/(π m² (n·h)⁴)
      //                       G: a = (h·o)/(m·sin θ), Λ(a) 的 Schlick 逼近
      //                       F: (1-n·v)^(5·e^(−2.69m)) / (1 + 22.7·m^1.5)
      //   uSpecularPower    — 兼容旧 Blinn-Phong（过渡期保留；完全切换后可删）
      //   uFresnelPower     — 同上，旧 Schlick 的指数
      // ============================================================
      // uSpecularPower: { type: UniformType.ONE_F, value: p.specularPower },
      // uFresnelPower: { type: UniformType.ONE_F, value: p.fresnelPower },

      // ============================================================
      // 12 远近衰减
      // ============================================================
      // uFoamDepthAttenuation: { type: UniformType.ONE_F, value: p.foamDepthAttenuation }

      // // ============================================================
      // // 14 Foam
      // // ============================================================
      // uFoamBias: { type: UniformType.ONE_F, value: p.foamBias },
      // uFoamPower: { type: UniformType.ONE_F, value: p.foamPower },
      // uFoamAdd: { type: UniformType.ONE_F, value: p.foamAdd },
      // uFoamDecayRate: { type: UniformType.ONE_F, value: p.foamDecayRate },
    }

    // ============================================================
    // 12) Per-cascade 的 FFT 输出（i = 0..3；超出 4 层的部分被 shader 忽略）
    //
    //    uDisplacementMap[i]   — (Dx, Dy, Dz, foam)，layer-0 的 .y 即 H（波高）
    //    uGradientMap[i]       — (∂Dy/∂x, ∂Dy/∂z)，用于重建 meso 法线
    //    uDispDerivativeMap[i] — (∂Dx/∂x, ∂Dz/∂z, ∂Dx/∂z, ∂Dz/∂x)（.a = jacobian）
    //    uLayerSize[i]         — 该层物理波长 L（米），uv = worldXZ / L
    //    uLayerContribute[i]   — 采样侧混合权重（艺术量，默认 1.0）
    // ============================================================
    // for (let i = 0; i < oceanParamsCascade.length; i++) {
    //   // ---- FFT Ocean 纹理 ----
    //   uniforms[`uDisplacementMap${i}`] = { type: UniformType.TEXTURE_2D, value: null }
    //   uniforms[`uGradientMap${i}`] = { type: UniformType.TEXTURE_2D, value: null }
    //   uniforms[`uDispDerivativeMap${i}`] = { type: UniformType.TEXTURE_2D, value: null }
    //   // 采样侧混合权重（艺术量），默认 1.0
    //   uniforms[`uLayerContribute${i}`] = {
    //     type: UniformType.ONE_F,
    //     value: oceanParamsCascade[i]!.layerContribute ?? 1.0
    //   }
    //   // ---- FFT Ocean 几何参数 ----
    //   uniforms[`uLayerSize${i}`] = { type: UniformType.ONE_F, value: 0 }
    // }
    for (let i = 0; i < layerBlendConfigs.length; i++) {
      const layerBlendConfig = layerBlendConfigs[i]!

      uniforms[`uDisplacementMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: null
      }
      uniforms[`uGradientMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: null
      }
      uniforms[`uDispDerivativeMap${i}`] = {
        type: UniformType.TEXTURE_2D,
        value: null
      }
      uniforms[`uLayerContribute${i}`] = {
        type: UniformType.ONE_F,
        value: layerBlendConfig.layerContribute ?? 1
      }
      uniforms[`uLayerSize${i}`] = {
        type: UniformType.ONE_F,
        value: 0
      }
    }

    super(label, uniforms, null)
  }

  // ---- 运行时更新（供 ComputeManager 每帧调用） ----

  /** 更新 FFT 输出纹理 */
  setDisplacementMap(texture: WebGLTexture): void {
    this.uniforms['uDisplacementMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  setGradientMap(texture: WebGLTexture): void {
    this.uniforms['uGradientMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  setDispDerivativeMap(texture: WebGLTexture): void {
    this.uniforms['uDispDerivativeMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  /** 更新时间（用于 shader 中的动画效果，如泡沫闪烁） */
  setTime(time: number): void {
    this.uniforms['uTime'] = { type: UniformType.ONE_F, value: time }
  }
}
