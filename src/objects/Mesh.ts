import type { Transformation, TransformationParams } from '@/types/transformation'
import type { Vec3 } from '@/types/math'
import type { AttributeData } from '@/types/mesh'

export class TRSTransform implements Transformation {
  public translate: Vec3
  public scale: Vec3
  public rotate: Vec3

  constructor(translate: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1], rotate: Vec3 = [0, 0, 0]) {
    this.translate = translate
    this.scale = scale
    this.rotate = rotate
  }
}

export class Mesh {
  // 基本属性
  public indices: number[]
  public count: number
  public transform: TRSTransform

  // 顶点属性
  public verticesAttrib?: AttributeData
  public hasVertices: boolean = false
  public vertices?: Float32Array
  public verticesName?: string

  // 法线属性
  public normalsAttrib?: AttributeData
  public hasNormals: boolean = false
  public normals?: Float32Array
  public normalsName?: string

  // 纹理坐标属性
  public texcoordsAttrib?: AttributeData
  public hasTexcoords: boolean = false
  public texcoords?: Float32Array
  public texcoordsName?: string

  constructor(
    verticesAttrib: AttributeData,
    normalsAttrib: AttributeData,
    texcoordsAttrib: AttributeData,
    indices: number[],
    transform: TransformationParams
  ) {
    this.initVerticesAttrib(verticesAttrib)
    this.initNormalsAttrib(normalsAttrib)
    this.initTexcoordsAttrib(texcoordsAttrib)
    this.initIndices(indices)
    this.initTransformation(transform)
  }

  initVerticesAttrib(verticesAttrib: AttributeData) {
    this.verticesAttrib = verticesAttrib

    if (verticesAttrib != null) {
      this.hasVertices = true
      this.vertices = verticesAttrib.array
      this.verticesName = verticesAttrib.name
    }
  }
  initNormalsAttrib(normalsAttrib: AttributeData) {
    this.normalsAttrib = normalsAttrib

    if (normalsAttrib != null) {
      this.hasNormals = true
      this.normals = normalsAttrib.array
      this.normalsName = normalsAttrib.name
    }
  }
  initTexcoordsAttrib(texcoordsAttrib: AttributeData) {
    this.texcoordsAttrib = texcoordsAttrib

    if (texcoordsAttrib != null) {
      this.hasTexcoords = true
      this.texcoords = texcoordsAttrib.array
      this.texcoordsName = texcoordsAttrib.name
    }
  }
  initIndices(indices: number[]) {
    this.indices = indices
    this.count = indices.length
  }
  initTransformation(transform: TransformationParams) {
    const modelTranslation: Vec3 = [
      transform.modelTransX,
      transform.modelTransY,
      transform.modelTransZ
    ]
    const modelScale: Vec3 = [transform.modelScaleX, transform.modelScaleY, transform.modelScaleZ]
    const modelRotate: Vec3 = [
      transform.modelRotateX,
      transform.modelRotateY,
      transform.modelRotateZ
    ]
    let meshTrans = new TRSTransform(modelTranslation, modelScale, modelRotate)

    this.transform = meshTrans
  }

  static cube(transform: TransformationParams): Mesh {
    const positions: number[] = [
      // Front face
      -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,

      // Back face
      -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,

      // Top face
      -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,

      // Bottom face
      -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,

      // Right face
      1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,

      // Left face
      -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0
    ]
    const indices: number[] = [
      0,
      1,
      2,
      0,
      2,
      3, // front
      4,
      5,
      6,
      4,
      6,
      7, // back
      8,
      9,
      10,
      8,
      10,
      11, // top
      12,
      13,
      14,
      12,
      14,
      15, // bottom
      16,
      17,
      18,
      16,
      18,
      19, // right
      20,
      21,
      22,
      20,
      22,
      23 // left
    ]

    return new Mesh(
      { name: 'aVertexPosition', array: new Float32Array(positions) },
      null,
      null,
      indices,
      transform
    )
  }
}

// 重构之前的 Mesh
// class Mesh {
//   constructor(verticesAttrib, normalsAttrib, texcoordsAttrib, indices, transform) {
//     this.indices = indices
//     this.count = indices.length
//     this.hasVertices = false
//     this.hasNormals = false
//     this.hasTexcoords = false

//     const modelTranslation = [transform.modelTransX, transform.modelTransY, transform.modelTransZ]
//     const modelScale = [transform.modelScaleX, transform.modelScaleY, transform.modelScaleZ]
//     const modelRotate = [transform.modelRotateX, transform.modelRotateY, transform.modelRotateZ]
//     let meshTrans = new TRSTransform(modelTranslation, modelScale, modelRotate)

//     this.transform = meshTrans

//     let extraAttribs = []

//     if (verticesAttrib != null) {
//       this.hasVertices = true
//       this.vertices = verticesAttrib.array
//       this.verticesName = verticesAttrib.name
//     }
//     if (normalsAttrib != null) {
//       this.hasNormals = true
//       this.normals = normalsAttrib.array
//       this.normalsName = normalsAttrib.name
//     }
//     if (texcoordsAttrib != null) {
//       this.hasTexcoords = true
//       this.texcoords = texcoordsAttrib.array
//       this.texcoordsName = texcoordsAttrib.name
//     }
//   }

//   static cube(transform) {
//     const positions = [
//       // Front face
//       -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,

//       // Back face
//       -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,

//       // Top face
//       -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,

//       // Bottom face
//       -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,

//       // Right face
//       1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,

//       // Left face
//       -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0
//     ]
//     const indices = [
//       0,
//       1,
//       2,
//       0,
//       2,
//       3, // front
//       4,
//       5,
//       6,
//       4,
//       6,
//       7, // back
//       8,
//       9,
//       10,
//       8,
//       10,
//       11, // top
//       12,
//       13,
//       14,
//       12,
//       14,
//       15, // bottom
//       16,
//       17,
//       18,
//       16,
//       18,
//       19, // right
//       20,
//       21,
//       22,
//       20,
//       22,
//       23 // left
//     ]

//     return new Mesh(
//       { name: 'aVertexPosition', array: new Float32Array(positions) },
//       null,
//       null,
//       indices,
//       transform
//     )
//   }
// }
