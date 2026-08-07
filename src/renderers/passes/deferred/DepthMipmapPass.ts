import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { RenderPass } from '../types/RenderPass'
import { DepthMipmapFBO } from '@/framebuffers/DepthMipmapFBO'
import { GBufferFBO } from '@/framebuffers/GBufferFBO'
import { FullScreenQuad } from '@/objects/FullScreenQuad'
import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'

/**
 * 深度 Mipmap 生成 Pass
 *
 * 从 GBuffer 的 depth attachment 逐级生成 min-reduction 深度金字塔
 * 用于 Hi-Z 加速 ray marching
 *
 * Level 0: 直接拷贝 GBuffer depth
 * Level N: 对 Level N-1 做 2×2 min reduction
 */

export class DepthMipmapPass implements RenderPass {
  public readonly name: string = 'DepthMipmapPass'

  private gl: WebGLRenderingContext

  private gBufferFBO: GBufferFBO

  private depthMipmapFBO: DepthMipmapFBO
  private fullScreenQuad: FullScreenQuad
  private depthShader: Shader

  private constructor(
    gl: WebGLRenderingContext,
    gBufferFBO: GBufferFBO,
    depthMipmapFBO: DepthMipmapFBO,
    fullScreenQuad: FullScreenQuad,
    depthShader: Shader
  ) {
    this.gl = gl

    this.gBufferFBO = gBufferFBO

    this.depthMipmapFBO = depthMipmapFBO
    this.fullScreenQuad = fullScreenQuad
    this.depthShader = depthShader
  }

  static async create(
    gl: WebGLRenderingContext,
    gBufferFBO: GBufferFBO,
    width: number,
    height: number
  ): Promise<DepthMipmapPass> {
    const depthMipmapFBO = new DepthMipmapFBO(gl, width, height)

    const shader = await Shader.createShader(
      gl,
      ShaderPaths.SCENE_DEPTH_VERTEX,
      ShaderPaths.SCENE_DEPTH_FRAGMENT
    )

    const fullScreenQuad = new FullScreenQuad(gl, 'FullScreenQuad<DepthMipmapPass>')
    fullScreenQuad.createVBOs(gl)
    fullScreenQuad.cacheAttriLocations(shader)

    return new DepthMipmapPass(gl, gBufferFBO, depthMipmapFBO, fullScreenQuad, shader)
  }

  // _ 或者是 _ParameterName 可以避免 ts 警告：已声明“context”，但从未读取其值。
  execute(_context: FrameContext, _camera: PerspectiveCamera): void {
    const gl = this.gl
    const shader = this.depthShader

    shader.use()

    // 深度 mipmap 是全屏后处理，执行 fullScreenQuad.draw()，因此不需要深度测试
    gl.disable(gl.DEPTH_TEST)

    // level 0 FBO 作为最顶层，存有最精细的 depth texture， 随着 level 1、2、3... 的逐渐增加，depth texture 的精细度越来越低
    for (let lv = 0; lv < this.depthMipmapFBO.levelCount; lv++) {
      const curLevelFBO = this.depthMipmapFBO.getLevel(lv)
      const curDims = this.depthMipmapFBO.getDimensions(lv)

      // 绑定当前级 FBO
      curLevelFBO.bind()
      gl.viewport(0, 0, curDims.width, curDims.height)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      // 绑定源纹理
      // gl.activeTexture(gl.TEXTURE0)
      if (lv === 0) {
        // Level 0: 从 GBuffer depth 拷贝
        const depthTex = this.gBufferFBO.depthTexture
        if (depthTex) shader.setTexture2D('uGBufferDepth', depthTex, 0)
      } else {
        // Level 1+: 从上一级降采样
        const prevDepthTex = this.depthMipmapFBO.getTexture(lv - 1)
        if (prevDepthTex) shader.setTexture2D('uPrevDepthMipMap', prevDepthTex, 0)

        const prevDims = this.depthMipmapFBO.getDimensions(lv - 1)
        if (prevDims) shader.setVec3('uPrevMipSize', [prevDims.width, prevDims.height, 0])
      }

      shader.set1i('uCurLevel', lv)

      // this.fullScreenQuad.bind(gl)
      this.fullScreenQuad.bind(shader) // shader 即本 pass 的 depthShader
      gl.drawElements(
        gl.TRIANGLES,
        this.fullScreenQuad.count,
        this.fullScreenQuad.indexData!.type,
        0
      )

      curLevelFBO.unbind()
    }

    gl.enable(gl.DEPTH_TEST)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  }

  /** 供 SSRRenderPass 获取深度金字塔纹理 */
  getDepthMipmapFBO(): DepthMipmapFBO {
    return this.depthMipmapFBO
  }

  resize(width: number, height: number): void {
    this.depthMipmapFBO.resize(width, height)
  }

  dispose(): void {
    this.depthMipmapFBO.dispose()
    this.fullScreenQuad.dispose()
    this.depthShader.dispose()
  }
}
