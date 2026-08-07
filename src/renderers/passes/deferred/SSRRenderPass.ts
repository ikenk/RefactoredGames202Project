import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { RenderPass } from '../types/RenderPass'
import { GBufferFBO } from '@/framebuffers/GBufferFBO'
import { DepthMipmapFBO } from '@/framebuffers/DepthMipmapFBO'
import { Shader } from '@/shaders/Shader'
import { FullScreenQuad } from '@/objects/FullScreenQuad'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { Vec3 } from '@/math/types/math'

/**
 * SSR 最终着色 Pass
 *
 * 读取 GBuffer 5 张纹理 + Depth Mipmap 金字塔
 * 执行 Hi-Z ray marching 实现屏幕空间反射和间接光照
 * 输出到默认帧缓冲（屏幕）
 */
export class SSRRenderPass implements RenderPass {
  public readonly name: string = 'SSRRenderPass'

  private gl: WebGLRenderingContext

  private gBufferFBO: GBufferFBO
  // 暂时不用 depthMipmapFBO（当前 shader 用线性 ray march）
  // 后续升级 Hi-Z ray march 时会用到
  private depthMipmapFBO: DepthMipmapFBO

  private fullScreenQuad: FullScreenQuad
  private ssrShader: Shader

  // 光照参数
  // SSR Pass 是后处理，没有 Material 来管 uniform，
  // 所以光照参数存在 pass 自己身上
  private lightDir: Vec3 = [0, 0, 0]
  private lightRadiance: Vec3 = [0, 0, 0]

  constructor(
    gl: WebGLRenderingContext,
    gBufferFBO: GBufferFBO,
    depthMipmapFBO: DepthMipmapFBO,
    fullScreenQuad: FullScreenQuad,
    ssrShader: Shader
  ) {
    this.gl = gl

    this.gBufferFBO = gBufferFBO
    this.depthMipmapFBO = depthMipmapFBO

    this.fullScreenQuad = fullScreenQuad

    this.ssrShader = ssrShader
  }

  /**
   * 异步工厂
   *
   * 为什么用 static async create 而不是 constructor？
   * Shader.createShader 是异步的（fetch 文件 + 编译），constructor 不能 async
   *
   * 为什么要传 depthMipmapFBO？
   * 当前的线性 ray march 还没用它，但 Hi-Z 升级时需要。
   * 现在传入是为了后续不用改调用方代码
   */
  static async create(
    gl: WebGLRenderingContext,
    gBufferFBO: GBufferFBO,
    depthMipmapFBO: DepthMipmapFBO
  ): Promise<SSRRenderPass> {
    const shader = await Shader.createShader(
      gl,
      ShaderPaths.SSR_SINGLE_LIGHT_VERTEX,
      ShaderPaths.SSR_SINGLE_LIGHT_FRAGMENT
    )

    const fullScreenQuad = new FullScreenQuad(gl, 'FullScreenQuad<SSRRenderPass>')
    fullScreenQuad.createVBOs(gl)
    fullScreenQuad.cacheAttriLocations(shader)

    return new SSRRenderPass(gl, gBufferFBO, depthMipmapFBO, fullScreenQuad, shader)
  }

  /**
   * 设置光照参数
   *
   * 由 loadCaveScene 在初始化时调用。
   * 如果光源位置可以通过 GUI 调整，需要在每帧或光源变化时重新调用。
   *
   * @param lightDir 光照方向（从光源指向场景，会在 shader 中 normalize）
   * @param lightRadiance 光源辐射度 [r, g, b]
   */
  updateLightParams(lightDir: Vec3, lightRadiance: Vec3): void {
    this.lightDir = lightDir
    this.lightRadiance = lightRadiance
  }

  execute(_context: FrameContext, camera: PerspectiveCamera): void {
    const gl = this.gl
    const shader = this.ssrShader

    // ==================== 渲染到屏幕 ====================
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    shader.use()

    // ==================== 绑定 GBuffer 5 张纹理 ====================
    let unit = 0

    const diffuseTex = this.gBufferFBO.diffuseTexture
    if (diffuseTex) shader.setTexture2D('uGDiffuse', diffuseTex, unit++)

    const depthTex = this.gBufferFBO.depthTexture
    if (depthTex) shader.setTexture2D('uGDepth', depthTex, unit++)

    const normalTex = this.gBufferFBO.normalTexture
    if (normalTex) shader.setTexture2D('uGNormalWorld', normalTex, unit++)

    const shadowTex = this.gBufferFBO.shadowTexture
    if (shadowTex) shader.setTexture2D('uGShadow', shadowTex, unit++)

    const positionTex = this.gBufferFBO.positionTexture
    if (positionTex) shader.setTexture2D('uGPosWorld', positionTex, unit++)

    // ==================== 相机参数 ====================
    // shader 中的 GetDepth / GetScreenUV 需要 VP 矩阵
    // 把世界坐标投影到屏幕空间来判断 ray march 命中
    shader.setMat4('uViewMatrix', camera.matrixWorldInverse.elements)
    shader.setMat4('uProjectionMatrix', camera.projectionMatrix.elements)
    shader.setVec3('uCameraPos', [camera.position.x, camera.position.y, camera.position.z])

    // ==================== 光照参数 ====================
    shader.setVec3('uLightDir', this.lightDir)
    shader.setVec3('uLightRadiance', this.lightRadiance)

    // ==================== 绘制全屏 quad ====================
    // 后处理不需要深度测试
    gl.disable(gl.DEPTH_TEST)
    // this.fullScreenQuad.bind(gl)
    this.fullScreenQuad.bind(shader) // shader 即本 pass 的 ssrShader
    gl.drawElements(gl.TRIANGLES, this.fullScreenQuad.count, this.fullScreenQuad.indexData!.type, 0)
    gl.enable(gl.DEPTH_TEST)
  }

  resize(_width: number, _height: number): void {
    // 渲染到默认帧缓冲，尺寸由 gl.viewport 控制
    throw new Error('Method not implemented.')
  }

  dispose(): void {
    this.ssrShader.dispose()
    this.fullScreenQuad.dispose()
  }
}
