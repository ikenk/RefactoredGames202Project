export class FBO {
  gl
  gl_draw_buffers
  constructor(gl, gl_draw_buffers) {
    this.gl = gl
    this.gl_draw_buffers = gl_draw_buffers

    //创建帧缓冲区对象
    let framebuffer = this.gl.createFramebuffer()
    if (!framebuffer) {
      console.log('无法创建帧缓冲区对象')
      return this.error()
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)

    let GBufferNum = 5
    framebuffer.attachments = []
    framebuffer.textures = []

    for (let i = 0; i < GBufferNum; i++) {
      let attachment = this.gl_draw_buffers['COLOR_ATTACHMENT' + i + '_WEBGL']
      let texture = this.CreateAndBindColorTargetTexture(framebuffer, attachment)
      framebuffer.attachments.push(attachment)
      framebuffer.textures.push(texture)
    }
    // * Tell the WEBGL_draw_buffers extension which FBO attachments are
    //   being used. (This extension allows for multiple render targets.)
    this.gl_draw_buffers.drawBuffersWEBGL(framebuffer.attachments)

    // Create depth buffer
    let depthBuffer = this.gl.createRenderbuffer() // Create a renderbuffer object
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, depthBuffer) // Bind the object to target
    this.gl.renderbufferStorage(
      this.gl.RENDERBUFFER,
      this.gl.DEPTH_COMPONENT16,
      window.screen.width,
      window.screen.height
    )
    this.gl.framebufferRenderbuffer(
      this.gl.FRAMEBUFFER,
      this.gl.DEPTH_ATTACHMENT,
      this.gl.RENDERBUFFER,
      depthBuffer
    )

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null)

    return framebuffer
  }

  //定义错误函数
  error() {
    if (framebuffer) gl.deleteFramebuffer(framebuffer)
    if (texture) gl.deleteFramebuffer(texture)
    if (depthBuffer) gl.deleteFramebuffer(depthBuffer)
    return null
  }

  //创建纹理对象并设置其尺寸和参数
  CreateAndBindColorTargetTexture(fbo, attachment) {
    let texture = this.gl.createTexture()
    if (!texture) {
      console.log('无法创建纹理对象')
      return this.error()
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      window.screen.width,
      window.screen.height,
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
}
