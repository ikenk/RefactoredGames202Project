import { WebGLExtensionError } from '@/errors/EngineError/WebGLError/WebGLExtensionError'
import { logger } from '@/logging/Logger'
import { GLCapabilities } from './types/glCapabilities'

/** 全局 WebGL 能力标记，由 Engine.initGL 初始化 */
let _capabilities: GLCapabilities | null = null

/**
 * 初始化 _capabilities[GLCapabilities]（仅 initGL 调用一次）
 *
 * 👉 职责：
 * - 一次性查询所有 WebGL 扩展（gl.getExtension）+ 硬件上限（gl.getParameter）
 * - 把结果保存到模块内 _capabilities，供任何模块通过 getCapabilities() 读取
 *
 * ⚠️ 副作用：
 * - gl.getExtension 不仅是"查询"，还会**激活**该扩展（首次调用即注册）
 *   因此把所有扩展调用集中在这里 = 一站式启用 + 缓存能力位
 *
 * 👉 与 engine.ts 的分工：
 * - 本函数：只查询、只标注（不抛错）
 * - engine.ts.initGL：根据 caps.xxx 决定是否 fail-fast（必需扩展缺失 → throw）
 *
 * 👉 调用顺序约束：
 * - 必须在 getCapabilities() 之前调用
 * - 必须在创建任何依赖扩展的资源（FBO / 纹理 / shader）之前调用
 */
export function initCapabilities(gl: WebGLRenderingContext): GLCapabilities {
  const ctx = '[GLCapabilities]'
  if (_capabilities) {
    console.warn('[GLCapabilities] Already initialized')
    return _capabilities
  }

  const dbg = gl.getExtension('WEBGL_debug_renderer_info')

  _capabilities = {
    // ---- 扩展检查 ----
    /**
     * OES（OpenGL ES Working Group，最早来自 GLES）
     * 例如：
     *   - OES_texture_float
     *   - OES_texture_half_float
     *   - OES_standard_derivatives
     *
     * EXT（OpenGL Extension Registry，多个厂商共同提出的通用扩展）
     * 例如：
     *   - EXT_color_buffer_half_float
     *   - EXT_shader_texture_lod
     *   - EXT_disjoint_timer_query
     *
     * WEBGL（WebGL Working Group 自己发明的扩展）
     * 例如：
     *   - WEBGL_depth_texture
     *   - WEBGL_color_buffer_float
     *   - WEBGL_debug_renderer_info
     */
    // | 创建纹理                 | 渲染到纹理                   |
    // | ---------------------- | --------------------------- |
    // | OES_texture_float      | WEBGL_color_buffer_float    |
    // | OES_texture_half_float | EXT_color_buffer_half_float |
    halfFloatTexture: !!gl.getExtension('OES_texture_half_float'), // 允许创建和使用 RGBA16F Texture 作为纹理源（可被采样），但不一定能作为渲染目标
    colorBufferHalfFloat: !!gl.getExtension('EXT_color_buffer_half_float'), // 允许 RGBA16F Texture 渲染到 Framebuffer Attachment
    floatTexture: !!gl.getExtension('OES_texture_float'), // 允许创建和使用 Float Texture 作为纹理源（可被采样），但不一定能作为渲染目标
    colorBufferFloat: !!gl.getExtension('WEBGL_color_buffer_float'), // 允许 Float Texture 渲染到 Framebuffer Attachment
    depthTexture: !!gl.getExtension('WEBGL_depth_texture'),
    floatLinearFilter: !!gl.getExtension('OES_texture_float_linear'), // 允许对浮点纹理使用线性过滤（LINEAR），否则只能 NEAREST
    fboRenderMipmap: !!gl.getExtension('OES_fbo_render_mipmap'),
    textureLOD: !!gl.getExtension('EXT_shader_texture_lod'),
    standardDerivatives: !!gl.getExtension('OES_standard_derivatives'),
    drawBuffers: !!gl.getExtension('WEBGL_draw_buffers'),
    elementIndexUint: !!gl.getExtension('OES_element_index_uint'), // 允许 drawElements 使用 UNSIGNED_INT（32bit），突破 65535 顶点上限

    // ---- 默认 framebuffer 的格式 ----
    colorBits: [
      gl.getParameter(gl.RED_BITS),
      gl.getParameter(gl.GREEN_BITS),
      gl.getParameter(gl.BLUE_BITS),
      gl.getParameter(gl.ALPHA_BITS)
    ] as [number, number, number, number],
    depthBits: gl.getParameter(gl.DEPTH_BITS) as number,
    contextAttributes: gl.getContextAttributes(),

    // ---- 硬件上限 ----
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    maxVertexTextureUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) as number,
    maxFragmentTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number,
    maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS) as number,
    maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) as number,
    maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) as number,

    // ---- 片元 highp 精度（移动端关键）----
    fragHighpSupported: (() => {
      const p = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
      return !!p && p.precision > 0
    })(),

    // ---- GPU 型号（排查移动端/集显问题）----
    gpuRenderer: (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown') as string,
    gpuVendor: (dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'unknown') as string,

    vertexArrayObject: gl.getExtension('OES_vertex_array_object')
  }

  logger.debug(`${ctx} `, _capabilities)
  return _capabilities
}

/**
 * 获取 _capabilities[GLCapabilities]（任何地方直接 import 调用）
 *
 * 👉 用法：
 *   import { getCapabilities } from '@/_config/glCapabilities'
 *   if (!getCapabilities().floatLinearFilter) { ... fallback ... }
 *
 * ❗ 调用约束：
 * - 必须先在 Engine.initGL 中调用 initCapabilities(gl)
 * - 否则抛 WebGLExtensionError（提示未初始化）
 */
export function getCapabilities(): GLCapabilities {
  if (!_capabilities) {
    throw new WebGLExtensionError(
      '[GLCapabilities]',
      '[GLCapabilities] Not initialized. Call initCapabilities() first.'
    )
  }

  return _capabilities
}
