import { getCapabilities } from '@/_config/glCapabilities'
import { MipmappedCubemapFBO } from '@/framebuffers/MipmappedCubemapFBO'
import { createCubeVBO } from '../shared/createCubeVBO'
import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { FBO } from '@/framebuffers/FBO'
import { FullScreenQuad } from '@/objects/FullScreenQuad'
import { TextureLoadError } from '@/errors/EngineError/TextureError/TextureLoadError'
import { captureGLState, restoreGLState, setCleanBakeState } from '@/utils/gl/withCleanGLState'

export interface GenerateBRDFLUTOptions {
  resolution?: number // LUT 边长，默认 256
  sampleCount?: number // 积分采样次数，默认 1024
}

/**
 * 离线生成 BRDF LUT（2D 纹理）。
 *
 *   BRDF_LUT(NdotV, roughness) = (scale, bias) 两个分量
 *   ∫ f_spec · cos θ dω ≈ F₀ · scale + bias
 *
 *   scale = ∫ (1 - (1 - VdotH)^5) · G_Vis dω    （R 通道）
 *   bias  = ∫ (1 - VdotH)^5 · G_Vis dω           （G 通道）
 *
 * 与 envmap 无关、与材质 F₀ 无关 → 全局只生成一次。
 */
export async function generateBRDFLUT(
  gl: WebGLRenderingContext,
  options: GenerateBRDFLUTOptions = {}
): Promise<WebGLTexture> {
  const ctx = '[generateBRDFLUT]'

  const resolution = options.resolution ?? 256
  const sampleCount = options.sampleCount ?? 1024 // GGX 重要性采样次数，默认 1024

  const fbo = new FBO(gl, {
    width: resolution,
    height: resolution,
    colorAttachmentCount: 1,
    depthMode: 'renderbuffer',
    colorTextureConfig: {
      internalFormat: gl.RGBA,
      format: gl.RGBA,
      type: getCapabilities().floatTexture ? gl.FLOAT : gl.UNSIGNED_BYTE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      generateMipmap: false
    }
  })

  const shader = await Shader.createShader(
    gl,
    ShaderPaths.IBL_BRDF_LUT_VERTEX,
    ShaderPaths.IBL_BRDF_LUT_FRAGMENT
  )

  // 全屏 quad
  const fullScreenQuad = new FullScreenQuad(gl, `FullScreenQuad<${ctx}>`)
  fullScreenQuad.createVBOs(gl)
  fullScreenQuad.cacheAttriLocations(shader)

  const saved = captureGLState(gl)
  setCleanBakeState(gl)

  fbo.bind()
  gl.viewport(0, 0, resolution, resolution)
  gl.disable(gl.DEPTH_TEST)
  gl.clear(gl.COLOR_BUFFER_BIT)

  shader.use()
  shader.set1i('uSampleCount', sampleCount)

  // fullScreenQuad.bind(gl)
  fullScreenQuad.bind(shader)
  gl.drawElements(gl.TRIANGLES, fullScreenQuad.count, fullScreenQuad.indexData!.type, 0)

  // 恢复 GL 状态
  restoreGLState(gl, saved)

  // 取 FBO 内部 texture
  const lut = fbo.releaseTexture(0)

  fullScreenQuad.dispose()
  shader.dispose()
  fbo.dispose()

  return lut
}
