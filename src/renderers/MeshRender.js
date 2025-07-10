import { mat4 } from 'gl-matrix'

export class MeshRender {
  // public
  gl
  mesh
  material
  shader
  // private
  #vertexBuffer
  #normalBuffer
  #texcoordBuffer
  #indicesBuffer

  constructor(gl, mesh, material) {
    this.gl = gl
    this.mesh = mesh
    this.material = material

    this.#vertexBuffer = this.gl.createBuffer()
    this.#normalBuffer = this.gl.createBuffer()
    this.#texcoordBuffer = this.gl.createBuffer()
    this.#indicesBuffer = this.gl.createBuffer()

    let extraAttribs = []
    if (mesh.hasVertices) {
      extraAttribs.push(mesh.verticesName)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#vertexBuffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.vertices, this.gl.STATIC_DRAW)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    }

    if (mesh.hasNormals) {
      extraAttribs.push(mesh.normalsName)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#normalBuffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.normals, this.gl.STATIC_DRAW)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    }

    if (mesh.hasTexcoords) {
      extraAttribs.push(mesh.texcoordsName)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#texcoordBuffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.texcoords, this.gl.STATIC_DRAW)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    }

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.#indicesBuffer)
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(mesh.indices),
      this.gl.STATIC_DRAW
    )
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null)

    // console.log(extraAttribs)

    this.material.setMeshAttribs(extraAttribs)
    this.shader = this.material.compile(this.gl)
  }

  bindGeometryInfo() {
    const gl = this.gl

    if (this.mesh.hasVertices) {
      const numComponents = 3
      const type = this.gl.FLOAT
      const normalize = false
      const stride = 0
      const offset = 0
      gl.bindBuffer(gl.ARRAY_BUFFER, this.#vertexBuffer)
      gl.vertexAttribPointer(
        this.shader.program.attribs[this.mesh.verticesName],
        numComponents,
        type,
        normalize,
        stride,
        offset
      )
      gl.enableVertexAttribArray(this.shader.program.attribs[this.mesh.verticesName])
    }

    if (this.mesh.hasNormals && this.shader.program.attribs[this.mesh.normalsName] >= 0) {
      const numComponents = 3
      const type = this.gl.FLOAT
      const normalize = false
      const stride = 0
      const offset = 0
      gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#normalBuffer)
      gl.vertexAttribPointer(
        this.shader.program.attribs[this.mesh.normalsName],
        numComponents,
        type,
        normalize,
        stride,
        offset
      )
      gl.enableVertexAttribArray(this.shader.program.attribs[this.mesh.normalsName])
    }

    if (this.mesh.hasTexcoords && this.shader.program.attribs[this.mesh.texcoordsName] >= 0) {
      const numComponents = 2
      const type = this.gl.FLOAT
      const normalize = false
      const stride = 0
      const offset = 0
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#texcoordBuffer)
      this.gl.vertexAttribPointer(
        this.shader.program.attribs[this.mesh.texcoordsName],
        numComponents,
        type,
        normalize,
        stride,
        offset
      )
      gl.enableVertexAttribArray(this.shader.program.attribs[this.mesh.texcoordsName])
    }

    gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.#indicesBuffer)
  }

  bindCameraParameters(camera) {
    const gl = this.gl

    let modelMatrix = mat4.create()
    let viewMatrix = mat4.create()
    let projectionMatrix = mat4.create()
    // Model transform
    mat4.identity(modelMatrix)
    mat4.translate(modelMatrix, modelMatrix, this.mesh.transform.translate)
    mat4.scale(modelMatrix, modelMatrix, this.mesh.transform.scale)
    mat4.rotateX(modelMatrix, modelMatrix, this.mesh.transform.rotate[0])
    mat4.rotateY(modelMatrix, modelMatrix, this.mesh.transform.rotate[1])
    mat4.rotateZ(modelMatrix, modelMatrix, this.mesh.transform.rotate[2])

    // View transform
    camera.updateMatrixWorld()
    mat4.invert(viewMatrix, camera.matrixWorld.elements)
    // Projection transform
    mat4.copy(projectionMatrix, camera.projectionMatrix.elements)

    gl.uniformMatrix4fv(this.shader.program.uniforms.uProjectionMatrix, false, projectionMatrix)
    gl.uniformMatrix4fv(this.shader.program.uniforms.uModelMatrix, false, modelMatrix)
    gl.uniformMatrix4fv(this.shader.program.uniforms.uViewMatrix, false, viewMatrix)
    // console.log(camera.position)

    gl.uniform3fv(this.shader.program.uniforms.uCameraPos, [
      camera.position.x,
      camera.position.y,
      camera.position.z
    ])
  }

  bindMaterialParameters() {
    const gl = this.gl

    let textureNum = 0
    for (let k in this.material.uniforms) {
      if (this.material.uniforms[k].type == 'matrix4fv') {
        gl.uniformMatrix4fv(this.shader.program.uniforms[k], false, this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '3fv') {
        gl.uniform3fv(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '1f') {
        gl.uniform1f(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '1i') {
        gl.uniform1i(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == 'texture') {
        gl.activeTexture(this.gl.TEXTURE0 + textureNum)
        gl.bindTexture(this.gl.TEXTURE_2D, this.material.uniforms[k].value)
        gl.uniform1i(this.shader.program.uniforms[k], textureNum)
        textureNum += 1
      }
    }
  }

  updateMaterialParameters(parameters) {
    if (parameters == null) {
      return
    }
    for (let k in this.material.uniforms) {
      if (k in parameters) {
        this.material.uniforms[k].value = parameters[k]
      }
    }
  }

  draw(camera, gl_draw_buffers, fbo, updatedParamters) {
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.viewport(0.0, 0.0, window.screen.width, window.screen.height)
    if (fbo != null) {
      gl_draw_buffers.drawBuffersWEBGL(fbo.attachments)
    }
    gl.useProgram(this.shader.program.glShaderProgram)

    // Bind geometry information
    this.bindGeometryInfo()

    // Bind Camera parameters
    this.bindCameraParameters(camera)

    // Bind material parameters
    this.updateMaterialParameters(updatedParamters)
    this.bindMaterialParameters()

    // Draw
    {
      const vertexCount = this.mesh.count
      const type = gl.UNSIGNED_SHORT
      const offset = 0
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
}
