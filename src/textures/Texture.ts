import { Vec3 } from '@/types/math'

export class Texture {
  public texture: WebGLTexture

  constructor() {}
  CreateImageTexture(gl: WebGLRenderingContext, image: ImageBitmap) {
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    // Because images have to be download over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level: GLint = 0
    const internalFormat: GLint = gl.RGBA
    const width: GLsizei = 1
    const height: GLsizei = 1
    const border: GLint = 0
    const srcFormat: GLenum = gl.RGBA
    const srcType: GLenum = gl.UNSIGNED_BYTE
    const pixel: Uint8Array = new Uint8Array([0, 0, 255, 255]) // opaque blue

    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel
    )

    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image)

    gl.bindTexture(gl.TEXTURE_2D, null)

    this.CreateMipmap(gl, image.width, image.height)
  }

  CreateConstantTexture(gl: WebGLRenderingContext, buffer: Vec3, gamma: boolean = false) {
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    // Because images have to be download over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level: GLint = 0
    const internalFormat: GLint = gl.RGB
    const width: GLsizei = 1
    const height: GLsizei = 1
    const border: GLint = 0
    const srcFormat: GLenum = gl.RGB
    const srcType: GLenum = gl.UNSIGNED_BYTE
    let pixel: Uint8Array // opaque blue
    if (gamma) {
      pixel = new Uint8Array([
        Math.pow(buffer[0], 1.0 / 2.2) * 255,
        Math.pow(buffer[1], 1.0 / 2.2) * 255,
        Math.pow(buffer[2], 1.0 / 2.2) * 255,
        255
      ])
    } else {
      pixel = new Uint8Array([buffer[0] * 255, buffer[1] * 255, buffer[2] * 255, 255])
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel
    )

    gl.bindTexture(gl.TEXTURE_2D, null)

    this.CreateMipmap(gl, width, height)
  }

  CreateMipmap(gl: WebGLRenderingContext, width: GLsizei, height: GLsizei) {
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(width) && isPowerOf2(height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D)
    } else {
      // No, it's not a power of 2. Turn of mips and set
      // wrapping to clamp to edge
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEATE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEATE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    gl.bindTexture(gl.TEXTURE_2D, null)
  }
}

function isPowerOf2(value: number) {
  return (value & (value - 1)) == 0
}
