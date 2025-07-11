export class FBO {
  private gl: WebGLRenderingContext
  private gl_draw_buffers: WEBGL_draw_buffers

  private width: number
  private height: number

  public framebuffer: WebGLFramebuffer
  private depthBuffer: WebGLRenderbuffer

  constructor(
    gl: WebGLRenderingContext,
    gl_draw_buffers: WEBGL_draw_buffers,
    width?: number,
    height?: number
  ) {
    this.gl = gl
    this.gl_draw_buffers = gl_draw_buffers
    this.width = width || window.screen.width
    this.height = height || window.screen.height

    try {
      this.initFrameBuffer()
    } catch (error) {
      console.error('FBO初始化失败:', error)
      this.dispose()
    }
  }

  // 初始化 framebuffer
  initFrameBuffer() {
    //创建帧缓冲区对象
    this.framebuffer = this.gl.createFramebuffer()
    if (!this.framebuffer) {
      console.log('无法创建帧缓冲区对象')
      throw new Error('无法创建帧缓冲区对象')
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer)

    const GBufferNum = 5
    this.framebuffer.attachments = []
    this.framebuffer.textures = []
    for (let i = 0; i < GBufferNum; i++) {
      let attachment: GLenum = this.gl_draw_buffers['COLOR_ATTACHMENT' + i + '_WEBGL']
      let texture = this.CreateAndBindColorTargetTexture(attachment)
      this.framebuffer.attachments.push(attachment)
      this.framebuffer.textures.push(texture)
    }

    // 告诉WEBGL_draw_buffers扩展哪些FBO附件正在使用
    this.gl_draw_buffers.drawBuffersWEBGL(this.framebuffer.attachments)

    // 创建深度缓冲区
    this.createDepthBuffer()

    // 检查帧缓冲区完整性
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER)
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`帧缓冲区不完整: ${status}`)
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null)
  }

  //创建纹理对象并设置其尺寸和参数
  CreateAndBindColorTargetTexture(attachment: GLenum): WebGLTexture {
    let texture = this.gl.createTexture()
    if (!texture) {
      console.log('无法创建纹理对象')
      throw new Error('无法创建纹理对象')
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.width,
      this.height,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      null
    )
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, attachment, this.gl.TEXTURE_2D, texture, 0)
    return texture
  }

  // 创建深度缓冲区
  createDepthBuffer(): void {
    // Create depth buffer
    this.depthBuffer = this.gl.createRenderbuffer() // Create a renderbuffer object
    if (!this.depthBuffer) {
      throw new Error('无法创建深度缓冲区')
    }
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.depthBuffer) // Bind the object to target
    this.gl.renderbufferStorage(
      this.gl.RENDERBUFFER,
      this.gl.DEPTH_COMPONENT16,
      this.width,
      this.height
    )
    this.gl.framebufferRenderbuffer(
      this.gl.FRAMEBUFFER,
      this.gl.DEPTH_ATTACHMENT,
      this.gl.RENDERBUFFER,
      this.depthBuffer
    )
  }

  // 获取 framebuffer 属性
  getFrameBuffer(): WebGLFramebuffer {
    return this.framebuffer
  }

  // 清理资源
  dispose(): void {
    // 删除纹理
    for (const texture of this.framebuffer.textures) {
      if (texture) {
        this.gl.deleteTexture(texture)
      }
    }
    this.framebuffer.textures = []

    // 删除深度缓冲区
    if (this.depthBuffer) {
      this.gl.deleteRenderbuffer(this.depthBuffer)
      this.depthBuffer = null
    }

    // 删除帧缓冲区
    if (this.framebuffer) {
      this.gl.deleteFramebuffer(this.framebuffer)
      this.framebuffer = null
    }

    this.framebuffer.attachments = []
  }
}

// export class FBO {
//   gl
//   gl_draw_buffers
//   constructor(gl, gl_draw_buffers) {
//     this.gl = gl
//     this.gl_draw_buffers = gl_draw_buffers

//     //创建帧缓冲区对象
//     let framebuffer = this.gl.createFramebuffer()
//     if (!framebuffer) {
//       console.log('无法创建帧缓冲区对象')
//       return this.error()
//     }
//     this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)

//     let GBufferNum = 5
//     framebuffer.attachments = []
//     framebuffer.textures = []

//     for (let i = 0; i < GBufferNum; i++) {
//       let attachment = this.gl_draw_buffers['COLOR_ATTACHMENT' + i + '_WEBGL']
//       let texture = this.CreateAndBindColorTargetTexture(framebuffer, attachment)
//       framebuffer.attachments.push(attachment)
//       framebuffer.textures.push(texture)
//     }
//     // * Tell the WEBGL_draw_buffers extension which FBO attachments are
//     //   being used. (This extension allows for multiple render targets.)
//     this.gl_draw_buffers.drawBuffersWEBGL(framebuffer.attachments)

//     // Create depth buffer
//     let depthBuffer = this.gl.createRenderbuffer() // Create a renderbuffer object
//     this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, depthBuffer) // Bind the object to target
//     this.gl.renderbufferStorage(
//       this.gl.RENDERBUFFER,
//       this.gl.DEPTH_COMPONENT16,
//       window.screen.width,
//       window.screen.height
//     )
//     this.gl.framebufferRenderbuffer(
//       this.gl.FRAMEBUFFER,
//       this.gl.DEPTH_ATTACHMENT,
//       this.gl.RENDERBUFFER,
//       depthBuffer
//     )

//     this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
//     this.gl.bindTexture(this.gl.TEXTURE_2D, null)
//     this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null)

//     return framebuffer
//   }

//   //定义错误函数
//   error() {
//     if (framebuffer) gl.deleteFramebuffer(framebuffer)
//     if (texture) gl.deleteFramebuffer(texture)
//     if (depthBuffer) gl.deleteFramebuffer(depthBuffer)
//     return null
//   }

//   //创建纹理对象并设置其尺寸和参数
//   CreateAndBindColorTargetTexture(fbo, attachment) {
//     let texture = this.gl.createTexture()
//     if (!texture) {
//       console.log('无法创建纹理对象')
//       return this.error()
//     }
//     this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
//     this.gl.texImage2D(
//       this.gl.TEXTURE_2D,
//       0,
//       this.gl.RGBA,
//       window.screen.width,
//       window.screen.height,
//       0,
//       this.gl.RGBA,
//       this.gl.FLOAT,
//       null
//     )
//     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
//     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)
//     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
//     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

//     this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, attachment, this.gl.TEXTURE_2D, texture, 0)
//     return texture
//   }
// }
