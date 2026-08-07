import { getCapabilities } from '@/_config/glCapabilities'
import { MeshVBOCreationError } from '@/errors/EngineError/MeshError/MeshVBOCreationError'
import { InvalidTextureFormatError } from '@/errors/EngineError/TextureError/InvalidTextureFormatError'
import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { WebGLExtensionError } from '@/errors/EngineError/WebGLError/WebGLExtensionError'
import { unbindVAO } from '@/objects/gl/unbindVAO'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { Shader } from '@/shaders/Shader'
import { mat4 } from 'gl-matrix'
import { DataTexture } from 'three'
import { HDRSourceData } from './types/convertHDRToCubeMap'
import { ResourceLoadError } from '@/errors/EngineError/ResourceError/ResourceLoadError'

// ==================== 模块级私有辅助函数 ====================

// 创建 cubemap 采样时所需 6 个方向所对应的 view matrix（数组）
function getCaptureViewMatrices(): mat4[] {
  const viewMatrices = [
    mat4.lookAt(mat4.create(), [0, 0, 0], [1, 0, 0], [0, -1, 0]), // +X
    mat4.lookAt(mat4.create(), [0, 0, 0], [-1, 0, 0], [0, -1, 0]), // -X
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 1, 0], [0, 0, 1]), // +Y
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, -1, 0], [0, 0, -1]), // -Y
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, 1], [0, -1, 0]), // +Z
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, -1], [0, -1, 0]) // -Z
  ]

  return viewMatrices
}

function createCubeVBO(gl: WebGLRenderingContext): WebGLBuffer {
  const vertices = new Float32Array([
    1, 1, 1, 1, -1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, 1, 1, -1, 1, 1, 1, 1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1,
    -1, -1, -1, 1, 1, -1, 1, 1, -1, 1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, -1, 1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, -1, 1, -1, -1, -1, -1
  ])

  const vbo = gl.createBuffer()
  if (!vbo) {
    throw new MeshVBOCreationError(
      'vbo',
      'HDR to CubeMap conversion: failed to create cube VBO',
      'HDRToCubeMap_ToolCube'
    )
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  return vbo
}

/**
 * 画一次 cube（HDR → cubemap 烘焙用）
 *
 * 同 drawCube：本函数绕过 Mesh 直接操作顶点属性槽位，
 *    必须先 unbindVAO() 回到默认 VAO，否则会写脏某个 Mesh 的 VAO
 */
function renderCube(gl: WebGLRenderingContext, vbo: WebGLBuffer, shader: Shader) {
  unbindVAO()

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  const loc = shader.getAttribLocation('aVertexPosition')
  if (loc === -1) {
    console.warn(
      '[convertHDRToCubeMap] Attribute "aVertexPosition" not found in equirectToCubemap shader. ' +
        'CubeMap conversion will produce empty faces.'
    )
    return
  }
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 36)
  gl.disableVertexAttribArray(loc)
}

function isHDRSourceData(v: unknown): v is HDRSourceData {
  if (typeof v !== 'object' || v === null) return false

  // 断言成 Partial<> 之后逐个字段查类型 —— 比 'x' in v 更严，
  // 因为 'x' in v 只证明「键存在」，值可能是 undefined / 字符串 / 任何东西
  const o = v as Partial<HDRSourceData>

  return (
    ArrayBuffer.isView(o.data) && // TypedArray 都是 ArrayBufferView
    typeof o.width === 'number' &&
    typeof o.height === 'number'
  )
}

// ==================== 主函数 ====================
export async function convertHDRToCubeMap(
  gl: WebGLRenderingContext,
  dataTexture: DataTexture,
  resolution: number,
  options: { flipY: boolean; rotationY: number }
): Promise<WebGLTexture> {
  // 1. 验证输入 & 扩展
  const source: unknown = dataTexture.source.data
  if (!isHDRSourceData(source)) {
    throw new ResourceLoadError('image', 'HDR', {
      reason: 'DataTexture.source.data 不是预期的 { data, width, height } 形状'
    })
  }
  const { data, width, height } = source
  if (!(data instanceof Float32Array)) {
    throw new InvalidTextureFormatError('HDR 环境贴图必须使用 Float32Array 格式', {
      actualType: data.constructor.name
    })
  }
  if (!getCapabilities().floatTexture) {
    throw new WebGLExtensionError('OES_texture_float')
  }

  const channels = data.length / (width * height)
  const glFormat = channels === 3 ? gl.RGB : gl.RGBA

  // 2. 上传 HDR 2D 纹理
  const hdrTexture = gl.createTexture()
  if (!hdrTexture) throw new TextureCreationError('TEXTURE_2D', { width, height })
  gl.bindTexture(gl.TEXTURE_2D, hdrTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, width, height, 0, glFormat, gl.FLOAT, data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.bindTexture(gl.TEXTURE_2D, null)

  // 3. 创建空 CubeMap
  const cubemap = gl.createTexture()
  if (!cubemap) throw new TextureCreationError('TEXTURE_CUBE_MAP')
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap)
  for (let i = 0; i < 6; i++) {
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
      0,
      glFormat,
      resolution,
      resolution,
      0,
      glFormat,
      gl.FLOAT,
      null
    )
  }
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  // 4. 创建临时资源
  const vbo = createCubeVBO(gl)

  const shader = await Shader.createShader(
    gl,
    ShaderPaths.EQUIRECT_TO_CUBEMAP_VERTEX,
    ShaderPaths.EQUIRECT_TO_CUBEMAP_FRAGMENT
  )

  const fbo = gl.createFramebuffer()
  const rbo = gl.createRenderbuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, resolution, resolution)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo)

  // 5. 渲染 6 个面
  const projectionMatrix = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 10)
  const viewMatrices = getCaptureViewMatrices()
  const modelMatrix = mat4.create()
  const savedViewport = gl.getParameter(gl.VIEWPORT) as Int32Array
  const vpX = savedViewport[0] ?? 0
  const vpY = savedViewport[1] ?? 0
  const vpW = savedViewport[2] ?? gl.canvas.width
  const vpH = savedViewport[3] ?? gl.canvas.height

  gl.viewport(0, 0, resolution, resolution)

  shader.use()
  shader.setMat4('uModelMatrix', modelMatrix)
  shader.setMat4('uProjectionMatrix', projectionMatrix)
  shader.setTexture2D('uEquirectangularMap', hdrTexture, 0)
  shader.set1f('uFlipY', options.flipY ? -1.0 : 1.0)
  shader.set1f('uRotationY', (options.rotationY * Math.PI) / 180)

  for (let i = 0; i < 6; i++) {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
      cubemap,
      0
    )
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    shader.setMat4('uViewMatrix', viewMatrices[i]!)

    renderCube(gl, vbo, shader)
  }

  // 6. 生成 mipmap
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap)
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)

  // 7. 清理全部临时资源
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(vpX, vpY, vpW, vpH)
  gl.deleteTexture(hdrTexture)
  gl.deleteFramebuffer(fbo)
  gl.deleteRenderbuffer(rbo)
  gl.deleteBuffer(vbo)
  shader.dispose()

  return cubemap
}
