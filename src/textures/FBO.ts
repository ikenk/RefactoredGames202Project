export class FBO {
  private gl: WebGLRenderingContext
  private gl_draw_buffers: WEBGL_draw_buffers

  private width: number
  private height: number

  public framebuffer: WebGLFramebuffer
  private renderBufferObject: WebGLRenderbuffer

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
  private initFrameBuffer() {
    //创建帧缓冲区对象
    this.framebuffer = this.gl.createFramebuffer()
    if (!this.framebuffer) {
      console.log('无法创建帧缓冲区对象')
      throw new Error('无法创建帧缓冲区对象')
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer)

    const GBufferNum = 5
    // 给 WebGL 的 framebuffer 按上两个原来没有的 attachments 和 textures 属性
    this.framebuffer.attachments = []
    this.framebuffer.textures = []
    for (let i = 0; i < GBufferNum; i++) {
      let attachment: GLenum = this.gl_draw_buffers['COLOR_ATTACHMENT' + i + '_WEBGL']
      // 将 texture 作为 framebuffer 中的 color_attachment 中的 buffer
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
  private CreateAndBindColorTargetTexture(attachment: GLenum): WebGLTexture {
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

  // 创建渲染缓冲对象，其为 depth buffer 的一种实现方式，深度测试时使用这个 rbo
  // 详见 https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/05%20Framebuffers/
  createDepthBuffer(): void {
    // 创建一个 renderbuffer object（渲染缓冲对象）存储 depth test 时的信息
    this.renderBufferObject = this.gl.createRenderbuffer()
    if (!this.renderBufferObject) {
      throw new Error('无法创建渲染缓冲对象')
    }
    // 将 rbo 绑定到当前的 RENDERBUFFER 槽中
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.renderBufferObject)
    // 为当前绑定到 RENDERBUFFER 槽位的数据（即 rbo）分配内存，内部数据格式为 DEPTH_COMPONENT16
    this.gl.renderbufferStorage(
      this.gl.RENDERBUFFER, // 操作目标，表示当前绑定到 RENDERBUFFER 槽位的对象
      this.gl.DEPTH_COMPONENT16, // 内部格式，16 位深度格式，每像素 2 字节
      this.width, // 渲染缓冲的宽度尺寸
      this.height // 渲染缓冲的高度尺寸
    )
    // 将指定的 rbo 附加到当前帧缓冲的 DEPTH_ATTACHMENT，建立引用关系
    this.gl.framebufferRenderbuffer(
      this.gl.FRAMEBUFFER, // 帧缓冲目标，操作当前绑定的 framebuffer
      this.gl.DEPTH_ATTACHMENT, // 深度附件点，帧缓冲内部专门用于深度测试的"插槽"
      this.gl.RENDERBUFFER, // 对象类型，表明要附加渲染缓冲（不是纹理）
      this.renderBufferObject // 具体的渲染缓冲对象 ID
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
    if (this.renderBufferObject) {
      this.gl.deleteRenderbuffer(this.renderBufferObject)
      this.renderBufferObject = null
    }

    // 删除帧缓冲区
    if (this.framebuffer) {
      this.gl.deleteFramebuffer(this.framebuffer)
      this.framebuffer = null
    }

    this.framebuffer.attachments = []
  }
}

// 原 FBO 类
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
