import { unbindVAO } from '@/objects/gl/unbindVAO'
import { Shader } from '@/shaders/Shader'

/**
 * 用一个 36 顶点的立方体 VBO 画一次 cube（cubemap 烘焙用）
 *
 * ❗ 本函数绕过 Mesh 直接操作顶点属性槽位，因此必须先解绑 VAO：
 * - 否则这里的 enable / disableVertexAttribArray 会被记录进「当时恰好绑定着的那个 Mesh 的 VAO」，
 *   把那个 Mesh 的顶点属性状态改坏
 * - 解绑后所有操作都落在默认 VAO 上，而默认 VAO 没有任何 Mesh 会用来绘制
 */
export function drawCube(gl: WebGLRenderingContext, vbo: WebGLBuffer, shader: Shader) {
  unbindVAO()

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)

  const loc = shader.getAttribLocation('aVertexPosition')
  if (loc === -1) {
    console.warn(
      '[drawCube] Attribute "aVertexPosition" not found in equirectToCubemap shader. ' +
        'CubeMap conversion will produce empty faces.'
    )
    return
  }

  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 36)
  gl.disableVertexAttribArray(loc)
}
