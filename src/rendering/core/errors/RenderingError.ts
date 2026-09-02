import { EngineError } from '@/errors/EngineError/BaseError'
import type { ErrorContext } from '@/errors/EngineError/types/ErrorContext'

/**
 * Rendering 领域错误携带的结构化诊断信息。
 *
 * @remarks
 * 该类型沿用 `EngineError.context` 的只读字典协议。调用者可以记录资源标签、
 * shader 阶段或 framebuffer 状态等上下文，但消费方读取未知字段前仍需缩窄类型。
 */
export type RenderingErrorDetails = ErrorContext

/** WebGL1 可编译的两个 shader 阶段。 */
export type ShaderStage = 'vertex' | 'fragment'

/**
 * 所有新渲染架构错误的共同基类。
 *
 * @remarks
 * 构造函数复制并冻结 `details` 的最外层快照，再让 `EngineError.context` 与
 * `RenderingError.details` 指向同一个对象。这样，错误创建后调用者继续修改原始
 * details 对象，也不会篡改已经记录的诊断现场。
 */
export class RenderingError extends EngineError {
  /** 与 `EngineError.context` 引用相同对象的冻结诊断快照。 */
  public readonly details: RenderingErrorDetails

  /**
   * @param message - 面向开发者的可读错误描述。
   * @param code - 供程序分类、日志聚合或本地化映射使用的稳定错误码。
   * @param details - 创建错误时需要保留的领域上下文；只复制并冻结最外层。
   */
  constructor(message: string, code: string, details: RenderingErrorDetails = {}) {
    const frozenDetails: RenderingErrorDetails = Object.freeze({
      ...details
    })

    super(message, code, {
      context: frozenDetails,
      recoverable: false
    })

    this.details = frozenDetails
  }
}

/** 表示调用者继续使用已经完成逻辑释放的 CPU Resource。 */
export class ResourceDisposedError extends RenderingError {
  /** @param resourceName - 不依赖压缩后类名的稳定资源诊断类型。 */
  constructor(resourceName: string) {
    super(`${resourceName} has been disposed`, 'RESOURCE_DISPOSED', {
      resourceName
    })
  }
}

/**
 * 表示调用者要求立即释放仍被一个或多个 Scene 使用的 Resource。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][resource-strict-dispose]
 *
 * 该错误发生前必须保持 Resource 状态不变：不能减少引用数、不能通知 listener，
 * 也不能释放 CPU 或 GPU 表示。对于“资源可能仍在使用”的正常分支，应调用
 * `Resource.tryDispose()`，而不是依赖异常控制流程。
 */
export class ResourceHasSceneReferencesError extends RenderingError {
  /**
   * @param resourceName - 稳定的资源诊断类型。
   * @param sceneReferenceCount - 当前仍然存在的 Scene 引用数量。
   */
  constructor(resourceName: string, sceneReferenceCount: number) {
    const referenceState =
      sceneReferenceCount === 1
        ? '1 Scene reference remains'
        : `${sceneReferenceCount} Scene references remain`

    super(
      `${resourceName} cannot be disposed while ${referenceState}`,
      'RESOURCE_HAS_SCENE_REFERENCES',
      {
        resourceName,
        sceneReferenceCount
      }
    )
  }
}

/**
 * 表示调用者试图释放一个不存在的 Scene 引用。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][resource-scene-reference-count]
 *
 * 引用数必须在修改之前验证。抛出该错误后，计数仍保持为 0，Resource 不进入
 * disposed 状态，也不执行任何清理副作用。
 */
export class ResourceSceneReferenceUnderflowError extends RenderingError {
  /** @param resourceName - 稳定的资源诊断类型。 */
  constructor(resourceName: string) {
    super(
      `${resourceName} cannot release a Scene reference because its Scene reference count is already zero`,
      'RESOURCE_SCENE_REFERENCE_UNDERFLOW',
      {
        resourceName,
        sceneReferenceCount: 0
      }
    )
  }
}

/** 表示一次父子连接会让场景图产生祖先循环。 */
export class SceneGraphCycleError extends RenderingError {
  /**
   * @param parentLabel - 尝试收养子节点的父节点诊断标签。
   * @param childLabel - 会形成循环的子节点诊断标签。
   */
  constructor(parentLabel: string, childLabel: string) {
    super(
      `Adding ${childLabel} to ${parentLabel} would create a scene graph cycle`,
      'SCENE_GRAPH_CYCLE',
      {
        parentLabel,
        childLabel
      }
    )
  }
}

/** 表示同一次原子场景图操作重复接收了同一个节点对象。 */
export class DuplicateSceneNodeError extends RenderingError {
  /** @param nodeLabel - 重复节点的可读调试标签。 */
  constructor(nodeLabel: string) {
    super(
      `Scene node ${nodeLabel} appears more than once in the same operation`,
      'DUPLICATE_SCENE_NODE',
      {
        nodeLabel
      }
    )
  }
}

/** 表示顶点属性的元素布局或数据长度违反 Geometry 契约。 */
export class InvalidVertexAttributeError extends RenderingError {
  /**
   * @param attributeName - 出错属性的语义名称，例如 `position`。
   * @param reason - 具体违反的输入约束。
   */
  constructor(attributeName: string, reason: string) {
    super(`Vertex attribute ${attributeName} is invalid: ${reason}`, 'INVALID_VERTEX_ATTRIBUTE', {
      attributeName,
      reason
    })
  }
}

/** 表示多个顶点属性、索引或拓扑无法构成合法的 Geometry。 */
export class InvalidGeometryError extends RenderingError {
  /**
   * @param reason - Geometry 无效的主要原因。
   * @param details - 与该原因相关的额外计数、属性名或索引上下文。
   */
  constructor(reason: string, details: RenderingErrorDetails = {}) {
    super(`Geometry is invalid: ${reason}`, 'INVALID_GEOMETRY', {
      ...details,
      reason
    })
  }
}

/** 表示某个 WebGL `create*()` API 返回了 `null`。 */
export class WebGLResourceCreationError extends RenderingError {
  /**
   * @param resourceKind - 创建失败的 GPU 对象种类，例如 `buffer` 或 `texture`。
   * @param label - 调用位置提供的稳定资源标签。
   */
  constructor(resourceKind: string, label: string) {
    super(`WebGL failed to create ${resourceKind} for ${label}`, 'WEBGL_RESOURCE_CREATION_FAILED', {
      resourceKind,
      label
    })
  }
}

/** 表示浏览器没有为指定 canvas 创建 WebGL1 context。 */
export class WebGLContextCreationError extends RenderingError {
  /** @param canvasLabel - 请求 context 的 canvas 诊断标签。 */
  constructor(canvasLabel: string) {
    super(`WebGL1 context creation failed for ${canvasLabel}`, 'WEBGL_CONTEXT_CREATION_FAILED', {
      canvasLabel
    })
  }
}

/** 表示 context lost 期间仍尝试执行需要 GPU 状态的操作。 */
export class WebGLContextLostError extends RenderingError {
  /** @param operation - 被 context-lost 状态阻止的操作名称。 */
  constructor(operation: string) {
    super(`Cannot perform ${operation} while the WebGL context is lost`, 'WEBGL_CONTEXT_LOST', {
      operation
    })
  }
}

/** 表示 WebGL backend 已释放后仍收到方法调用。 */
export class WebGLBackendDisposedError extends RenderingError {
  /** @param operation - backend 释放后被调用的操作名称。 */
  constructor(operation: string) {
    super(
      `Cannot perform ${operation} after the WebGL backend has been disposed`,
      'WEBGL_BACKEND_DISPOSED',
      {
        operation
      }
    )
  }
}

/** 表示 WebGL shader compile status 失败。 */
export class ShaderCompilationError extends RenderingError {
  /**
   * @param shaderName - 逻辑 ShaderModule 的稳定名称。
   * @param stage - 编译失败的 vertex 或 fragment 阶段。
   * @param infoLog - WebGL 驱动返回的编译日志。
   */
  constructor(shaderName: string, stage: ShaderStage, infoLog: string) {
    super(
      `${stage} shader compilation failed for ${shaderName}: ${infoLog}`,
      'SHADER_COMPILATION_FAILED',
      {
        shaderName,
        stage,
        infoLog
      }
    )
  }
}

/** 表示 vertex/fragment shader 成功编译但 program link 失败。 */
export class ProgramLinkError extends RenderingError {
  /**
   * @param shaderName - 尝试链接的逻辑 ShaderModule 名称。
   * @param infoLog - WebGL 驱动返回的链接日志。
   */
  constructor(shaderName: string, infoLog: string) {
    super(`Program link failed for ${shaderName}: ${infoLog}`, 'PROGRAM_LINK_FAILED', {
      shaderName,
      infoLog
    })
  }
}

/** 表示 ShaderModule 没有提供当前 backend 所需的源码变体。 */
export class UnsupportedShaderVariantError extends RenderingError {
  /**
   * @param shaderName - 缺少变体的 ShaderModule 名称。
   * @param backendKind - 请求源码变体的 backend 种类。
   */
  constructor(shaderName: string, backendKind: string) {
    super(
      `Shader ${shaderName} does not provide a ${backendKind} variant`,
      'UNSUPPORTED_SHADER_VARIANT',
      {
        shaderName,
        backendKind
      }
    )
  }
}

/** 表示索引 TypedArray 无法映射为当前 WebGL1 能绘制的索引类型。 */
export class UnsupportedIndexTypeError extends RenderingError {
  /**
   * @param indexType - 原始索引数据类型。
   * @param reason - 扩展缺失或数值范围不允许降级等具体原因。
   */
  constructor(indexType: string, reason: string) {
    super(`Index type ${indexType} is unsupported: ${reason}`, 'UNSUPPORTED_INDEX_TYPE', {
      indexType,
      reason
    })
  }
}

/** 表示纹理图片或像素数据不满足上传要求。 */
export class InvalidTextureSourceError extends RenderingError {
  /**
   * @param textureLabel - 纹理逻辑标签。
   * @param reason - 尺寸、加载状态或数据形状等失败原因。
   */
  constructor(textureLabel: string, reason: string) {
    super(`Texture source ${textureLabel} is invalid: ${reason}`, 'INVALID_TEXTURE_SOURCE', {
      textureLabel,
      reason
    })
  }
}

/** 表示 framebuffer 创建成功但 completeness 检查失败。 */
export class IncompleteFramebufferError extends RenderingError {
  /**
   * @param status - `gl.checkFramebufferStatus()` 返回的原始枚举值。
   * @param targetLabel - 对应逻辑 RenderTarget 的诊断标签。
   */
  constructor(status: number, targetLabel: string) {
    super(
      `Framebuffer ${targetLabel} is incomplete with status ${status}`,
      'INCOMPLETE_FRAMEBUFFER',
      {
        status,
        targetLabel
      }
    )
  }
}

/** 表示逻辑 RenderTarget 当前不能被解析、绑定或采样。 */
export class RenderTargetUnavailableError extends RenderingError {
  /**
   * @param targetLabel - 不可用目标的稳定标签。
   * @param reason - disposed、attachment 缺失等具体原因。
   */
  constructor(targetLabel: string, reason: string) {
    super(`Render target ${targetLabel} is unavailable: ${reason}`, 'RENDER_TARGET_UNAVAILABLE', {
      targetLabel,
      reason
    })
  }
}

/** 表示请求的渲染能力超出当前 WebGL1 backend 的支持范围。 */
export class UnsupportedRenderFeatureError extends RenderingError {
  /**
   * @param feature - 不受支持的逻辑功能名称。
   * @param reason - 缺少扩展或能力限制等具体原因。
   */
  constructor(feature: string, reason: string) {
    super(`Render feature ${feature} is unsupported: ${reason}`, 'UNSUPPORTED_RENDER_FEATURE', {
      feature,
      reason
    })
  }
}
