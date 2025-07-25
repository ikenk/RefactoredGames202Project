export class imageUrlTexture {
  constructor(gl, url) {
    this.gl = gl
    this.url = url
    this.texture
  }

  async init() {
    var image = new Image()
    image.src = this.url
    var loadImage = async (img) => {
      return new Promise((resolve, reject) => {
        img.onload = async () => {
          console.log('Image Loaded')
          resolve(true)
        }
      })
    }
    await loadImage(image)

    var gl = this.gl
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    // Because images have to be download over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0
    const internalFormat = gl.RGBA
    const width = 1
    const height = 1
    const border = 0
    const srcFormat = gl.RGBA
    const srcType = gl.UNSIGNED_BYTE
    const pixel = new Uint8Array([0, 0, 255, 255]) // opaque blue
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

  CreateMipmap(gl, width, height) {
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
      //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEATE)
      //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEATE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    gl.bindTexture(gl.TEXTURE_2D, null)
  }
}
