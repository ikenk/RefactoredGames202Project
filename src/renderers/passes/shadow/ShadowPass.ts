import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { ShadowMapFBO } from '@/framebuffers/ShadowMapFBO'
import { DirectionalLight } from '@/lights/directionalLight/DirectionalLight-refactor'

/**
 * Shadow Pass：从灯光视角渲染场景深度到 Shadow Map。
 *
 * 流程：
 * 1. 绑定 Shadow FBO
 * 2. 用灯光的 VP 矩阵作为"相机"
 * 3. 对每个投射阴影的物体，渲染深度（用专用的 shadow shader）
 * 4. 解绑 FBO，Shadow Map 纹理可供 main pass 采样
 */
export class ShadowPass {
  private gl: WebGLRenderingContext
  private shader: Shader
  private shadowMapFBO: ShadowMapFBO

  private constructor(gl: WebGLRenderingContext, shader: Shader, shadowMapFBO: ShadowMapFBO) {
    this.gl = gl
    this.shader = shader
    this.shadowMapFBO = shadowMapFBO
  }

  /**
   * 根据 ShadowMapFBO 的深度模式自动选择正确的 shadow shader。
   *
   * - depth texture 模式 → fragment shader 为空（GPU 自动写深度）
   * - renderbuffer 模式 → fragment shader pack 深度到 RGBA
   */
  static async create(gl: WebGLRenderingContext, shadowMapFBO: ShadowMapFBO): Promise<ShadowPass> {
    const vertPath = ShaderPaths.SHADOW_VERTEX
    const fragPath = shadowMapFBO.useDepthTexture
      ? ShaderPaths.SHADOW_DEPTH_TEXTURE_FRAGMENT
      : ShaderPaths.SHADOW_RGBA_PACK_FRAGMENT

    const shader = await Shader.createShader(gl, vertPath, fragPath)

    return new ShadowPass(gl, shader, shadowMapFBO)
  }

  /**
   * 执行 shadow pass。
   *
   * @param light - 投射阴影的方向光
   * @param shadowMapFBO - 该光源对应的 shadow FBO
   * @param shadowCasters - 所有需要投射阴影的渲染器
   */
  drawDirectionalLight(light: DirectionalLight, shadowCasters: Iterable<BaseRenderer>) {
    const gl = this.gl

    // 1. 绑定 shadow FBO
    // this.shadowMapFBO.bind()
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)

    // 2. 使用 shadow shader
    this.shader.use()

    // 3. 设置灯光 VP 矩阵
    const lightVP = light.getViewProjectionMatrix()
    this.shader.setMat4('uLightVP', lightVP)

    // 4. 对每个 shadow caster 渲染深度
    for (const caster of shadowCasters) {
      const mesh = caster.mesh

      // 绑定 caster 的几何数据
      // mesh.bind(gl)
      // 绑定 caster 的几何数据
      // ❗ 必须传 this.shader（shadow shader），不能沿用 caster 自己的 forward shader：
      //    旧实现里 Mesh 只有一份 locationCache（按 forward shader 缓存），
      //    shadow pass 却拿它来绑定，仅仅因为两边的 aVertexPosition 碰巧都是 location 0 才没出事。
      //    一旦 shadow shader 增删 attribute 导致 location 变化，就会静默地把法线当顶点位置用。
      mesh.bind(this.shader)

      // 设置 model matrix
      const modelMatrix = mesh.getModelMatrix()
      this.shader.setMat4('uModelMatrix', modelMatrix)

      if (mesh.hasIndices) {
        gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexData!.type, 0)
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count)
      }
    }

    // // 5. 恢复
    // this.shadowMapFBO.unbind(gl.canvas.width, gl.canvas.height)
  }

  // /** 点光源 shadow pass（预留）：6 个 VP，渲染到 cube shadow map */
  // executePointLight(
  //   light: IPointLight & IPointShadow,
  //   cubeShadowFBO: CubeShadowMapFBO,
  //   shadowCasters: Iterable<BaseRenderer>
  // ): void {
  //   const matrices = light.getCubeViewProjectionMatrices()
  //   for (let face = 0; face < 6; face++) {
  //     cubeShadowFBO.bindFace(face)
  //     this.shader.setMat4('uLightVP', matrices[face])
  //     for (const caster of shadowCasters) { ... }
  //   }
  // }

  dispose(): void {
    this.shader?.dispose()
  }
}
