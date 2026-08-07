import { MeshError } from './BaseError'

// ============================================================
// MeshVAOCreationError - VAO 创建错误
// ============================================================

/**
 * Vertex Array Object 创建失败
 *
 * 👉 何时抛出：
 * - `Mesh.recordVAO()` 中 `ext.createVertexArrayOES()` 返回 null
 *
 * 👉 为什么不复用 MeshVBOCreationError：
 * - 那个类的 bufferType 只有 'vbo' | 'ibo'，会把错误码拼成 MESH_VBO_CREATION_VBO，
 *   toUserMessage() 也会说成「创建顶点缓冲区失败」—— 与事实不符
 * - 语义上二者也不是一回事：
 *   · VBO / IBO 装的是【数据】（顶点属性、索引）
 *   · VAO 装的是【状态】（16 个槽位的 enabled / buffer / 布局 + ELEMENT_ARRAY_BUFFER 绑定）
 * - 生命周期独立：删 VAO 不会删它引用的 VBO，反之亦然
 *
 * ❗ 触发原因：
 * - 几乎只在 WebGL 上下文丢失 (context lost) 时发生。VAO 是极小的状态对象，
 *   正常情况下不会因显存不足而分配失败
 *
 * ⚠️ 与「扩展缺失」区分：
 * - `OES_vertex_array_object` 不被支持是【另一个】错误（WebGLExtensionError），
 *   由 `Mesh.vaoExt` 这个 getter 抛出，走不到本错误
 */
export class MeshVAOCreationError extends MeshError {
  /** 这个 VAO 是为哪个 shader program 录制的（用于定位是哪条渲染路径出的问题） */
  public readonly shaderName?: string

  constructor(
    message: string,
    meshName: string,
    options: {
      shaderName?: string
      cause?: Error
    } = {}
  ) {
    super(message, 'MESH_VAO_CREATION', meshName, {
      context: {
        shaderName: options.shaderName ?? '(unknown shader)'
      },
      // 上下文丢失后由 webglcontextrestored 重建资源即可恢复
      recoverable: true,
      cause: options.cause
    })

    this.shaderName = options.shaderName
  }

  override toUserMessage(): string {
    return '创建顶点数组对象（VAO）失败。这通常是 WebGL 上下文丢失导致的，请尝试刷新页面。'
  }
}
