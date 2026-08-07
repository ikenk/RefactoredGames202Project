import { BASES } from '@/_config/basePaths'
import urlJoin from 'url-join'

const S = BASES.shaders

// Shader 路径配置
export const ShaderPaths = {
  // ==================== Gizmo ====================
  // Axis
  AXIS_VERTEX: urlJoin(S, 'gizmo/axis/vertex.vert'),
  AXIS_FRAGMENT: urlJoin(S, 'gizmo/axis/fragment.frag'),
  // Light Gizmo
  LIGHT_GIZMO_VERTEX: urlJoin(S, 'gizmo/lightGizmo/vertex.vert'),
  LIGHT_GIZMO_FRAGMENT: urlJoin(S, 'gizmo/lightGizmo/fragment.frag'),

  // ==================== Lighting & Shadow ====================
  DIRECT_LIGHT_VERTEX: urlJoin(S, 'lighting/directLight/vertex.vert'),
  DIRECT_LIGHT_FRAGMENT: urlJoin(S, 'lighting/directLight/fragment.frag'),
  // Shadow（共用 vertex）
  SHADOW_VERTEX: urlJoin(S, 'lighting/shadow/directional/vertex.vert'),
  // 两套 fragment
  SHADOW_RGBA_PACK_FRAGMENT: urlJoin(S, 'lighting/shadow/directional/rgbaPack.frag'),
  SHADOW_DEPTH_TEXTURE_FRAGMENT: urlJoin(S, 'lighting/shadow/directional/depthTexture.frag'),
  // HW4
  // Cook-Torrance Model
  HW4_COOK_TORRANCE_VERTEX: urlJoin(S, 'lighting/pbr/Cook-Torrance/vertex.vert'),
  HW4_COOK_TORRANCE_FRAGMENT: urlJoin(S, 'lighting/pbr/Cook-Torrance/fragment.frag'),
  // Kulla-Conty Model
  HW4_KULLA_CONTY_VERTEX: urlJoin(S, 'lighting/pbr/Kulla-Conty/vertex.vert'),
  HW4_KULLA_CONTY_FRAGMENT: urlJoin(S, 'lighting/pbr/Kulla-Conty/fragment.frag'),

  // ==================== PRT ====================
  // Spherical Harmonics
  TWO_ORDER_SH_VERTEX: urlJoin(S, 'prt/sphericalHarmonics/order2/vertex.vert'),
  TWO_ORDER_SH_FRAGMENT: urlJoin(S, 'prt/sphericalHarmonics/order2/fragment.frag'),
  THREE_ORDER_SH_VERTEX: urlJoin(S, 'prt/sphericalHarmonics/order3/vertex.vert'),
  THREE_ORDER_SH_FRAGMENT: urlJoin(S, 'prt/sphericalHarmonics/order3/fragment.frag'),

  // ==================== Deferred ====================
  // G-Buffer
  GBUFFER_VERTEX: urlJoin(S, 'deferred/gbuffer/vertex.vert'),
  GBUFFER_FRAGMENT: urlJoin(S, 'deferred/gbuffer/fragment.frag'),
  // Scene Depth
  SCENE_DEPTH_VERTEX: urlJoin(S, 'deferred/sceneDepth/vertex.vert'),
  SCENE_DEPTH_FRAGMENT: urlJoin(S, 'deferred/sceneDepth/fragment.frag'),
  // SSR
  SSR_SINGLE_LIGHT_VERTEX: urlJoin(S, 'deferred/ssr/singleLight/vertex.vert'),
  SSR_SINGLE_LIGHT_FRAGMENT: urlJoin(S, 'deferred/ssr/singleLight/fragment.frag'),

  // ==================== Postprocess ====================
  // blit
  BLIT_VERTEX: urlJoin(S, 'postprocess/blit/vertex.vert'),
  BLIT_FRAGMENT: urlJoin(S, 'postprocess/blit/fragment.frag'),

  // ==================== Environment ====================
  // converters
  EQUIRECT_TO_CUBEMAP_VERTEX: urlJoin(S, 'environment/converters/equirectToCubemap/vertex.vert'),
  EQUIRECT_TO_CUBEMAP_FRAGMENT: urlJoin(
    S,
    'environment/converters/equirectToCubemap/fragment.frag'
  ),
  CUBEMAP_LINEARIZE_VERTEX: urlJoin(S, 'environment/converters/linearize/vertex.vert'),
  CUBEMAP_LINEARIZE_FRAGMENT: urlJoin(S, 'environment/converters/linearize/fragment.frag'),
  // IBL
  IRRADIANCE_VERTEX: urlJoin(S, 'environment/IBL/irradiance/vertex.vert'),
  IRRADIANCE_FRAGMENT: urlJoin(S, 'environment/IBL/irradiance/fragment.frag'),
  IBL_PREFILTER_VERTEX: urlJoin(S, 'environment/IBL/prefilter/vertex.vert'),
  IBL_PREFILTER_FRAGMENT: urlJoin(S, 'environment/IBL/prefilter/fragment.frag'),
  IBL_BRDF_LUT_VERTEX: urlJoin(S, 'environment/IBL/brdfLUT/vertex.vert'),
  IBL_BRDF_LUT_FRAGMENT: urlJoin(S, 'environment/IBL/brdfLUT/fragment.frag'),
  // Skybox
  SKYBOX_VERTEX: urlJoin(S, 'environment/skybox/vertex.vert'),
  SKYBOX_FRAGMENT: urlJoin(S, 'environment/skybox/fragment.frag'),
  // HW2 Background Cubemap
  CUBEMAP_BG_VERTEX: urlJoin(S, 'environment/cubemapBackground/vertex.vert'),
  CUBEMAP_BG_FRAGMENT: urlJoin(S, 'environment/cubemapBackground/fragment.frag'),

  // ==================== Ocean ====================
  // FFT Ocean
  // FFT_OCEAN_VERTEX: urlJoin(S, 'water/fftOcean/vertex.vert'),
  // FFT_OCEAN_FRAGMENT: urlJoin(S, 'water/fftOcean/fragment.frag'),
  FFT_OCEAN_MULTI_LAYERS_VERTEX: urlJoin(S, 'water/fftOcean/vertex-multi-layers.vert'),
  FFT_OCEAN_MULTI_LAYERS_FRAGMENT: urlJoin(S, 'water/fftOcean/fragment-multi-layers.frag'),
  // FFT Ocean -- Compute Shader
  FFT_STOCKHAM_VERTEX: urlJoin(S, 'water/fftOcean/compute/fftStockham/FFTStockham.vert'),
  FFT_STOCKHAM_1D_FRAGMENT: urlJoin(S, 'water/fftOcean/compute/fftStockham/FFTStockham1D.frag'),
  FFT_STOCKHAM_2D_FRAGMENT: urlJoin(S, 'water/fftOcean/compute/fftStockham/FFTStockham2D.frag'),
  FFT_PACKED_ASSEMBLY_VERTEX: urlJoin(S, 'water/fftOcean/compute/packedAssembly/vertex.vert'),
  FFT_PACKED_ASSEMBLY_FRAGMENT: urlJoin(S, 'water/fftOcean/compute/packedAssembly/fragment.frag'),
  FFT_REALTIME_SPECTRUM_VERTEX: urlJoin(S, 'water/fftOcean/compute/realtimeSpectrum/vertex.vert'),
  FFT_REALTIME_SPECTRUM_FRAGMENT: urlJoin(
    S,
    'water/fftOcean/compute/realtimeSpectrum/fragment.frag'
  ),
  // Sine Wave
  SINE_WAVE_VERTEX: urlJoin(S, 'water/simpleWaves/sineWave/vertex.vert'),
  SINE_WAVE_FRAGMENT: urlJoin(S, 'water/simpleWaves/sineWave/fragment.frag'),
  // Gerstner Wave
  GERSTNER_WAVE_VERTEX: urlJoin(S, 'water/simpleWaves/gerstnerWave/vertex.vert'),
  GERSTNER_WAVE_FRAGMENT: urlJoin(S, 'water/simpleWaves/gerstnerWave/fragment.frag'),

  // ==================== Shadertoy ====================
  SHADERTOY_COMMON_VERTEX: urlJoin(S, 'shadertoy/commonVertex.vert'),
  SHADERTOY_LERRAIN_CLOUD_OVER_SEA_AND_PEAK_FRAGMENT: urlJoin(
    S,
    'shadertoy/lerrain/cloudsOverSeaAndPeaks/fragment.frag'
  )
}
