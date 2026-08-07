import { FFTOceanMaterial } from '@/materials/water/FFTOceanMaterial'
import { WaterSurface } from '@/objects/WaterSurface'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { LineRenderer } from '@/renderers/LineRenderer'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { FFTOceanConfig } from '@/scenes/water/fftOcean/types/FFTOceanConfig'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { Shader } from '@/shaders/Shader'

// ============================================================
//  createFFTOceanRenderer
//
//  职责：仅创建 ocean 的 Mesh + Material + Shader → BaseRenderer
//  不再创建 ComputePass（抽象层级不同）
//
//  纹理来源：
//  FFTOceanComputePass 在 execute() 中完成 IFFT 后，
//  通过 applyOutputTextures(renderer) → renderer.updateMaterialUniforms()
//  将纹理推送到 material，无需此处传入纹理引用。
//
//  上层组装示例：
//    // 1. 创建 ComputePass（独立 RenderPass）
//    const computePass = new FFTOceanComputePass(gl, oceanParams)
//    webGLRenderer.addRenderPass(computePass)
//
//    // 2. 创建 ocean renderer（Mesh + Material + Shader）
//    const renderer = await createFFTOceanRenderer(gl, forwardPass, config)
//
//    // 3. 注册 receiver（ComputePass 每帧推送纹理）
//    computePass.addReceiver(renderer)
// ============================================================

/**
 * 创建 FFT 海洋的 Mesh + Material + Shader → BaseRenderer
 * 并注册到 ForwardRenderPass
 *
 * 装配流程：
 *   1. WaterSurface → 平面网格
 *   2. FFTOceanMaterial → uniforms（纹理由 ComputePass 每帧推送，此处不需要传入）
 *   3. Shader → 编译链接
 *   4. BaseRenderer → 绑定 Mesh + Material + Shader
 *   5. 注册到 ForwardRenderPass
 */
export async function createFFTOceanRenderer(
  gl: WebGLRenderingContext,
  config: FFTOceanConfig
): Promise<BaseRenderer> {
  const {
    surfaceSize,
    surfaceMeshResolution,
    materialConfig,
    transform,
    renderingMode,
    oceanParams
  } = config

  const ctx = '[createFFTOceanRenderer]'
  const rendererName = 'FFTOceanRenderer'

  // 1: 平面网格
  const mesh = new WaterSurface(gl, transform, surfaceSize, surfaceMeshResolution)

  // 2: 材质
  // 纹理 uniform（uDisplacementMap 等）不需要此处填入，FFTOceanComputePass.applyOutputTextures() 会通过 updateMaterialUniforms 推送
  const material = new FFTOceanMaterial(
    `${ctx} FFTOceanMaterial<${rendererName}>`,
    oceanParams,
    materialConfig
  )

  // Step 3: 着色器
  const shader = await Shader.createShader(
    gl,
    ShaderPaths.FFT_OCEAN_VERTEX,
    ShaderPaths.FFT_OCEAN_FRAGMENT
  )

  // 4: 渲染器
  let renderer: BaseRenderer

  if (renderingMode === 'MESH') {
    renderer = new MeshRenderer(gl, mesh, material, shader, `${ctx} ${rendererName}`)
  } else {
    renderer = new LineRenderer(gl, mesh, material, shader, renderingMode, `${ctx} ${rendererName}`)
  }

  return renderer
}
