import { describe, expect, it } from 'vitest'

import { EngineError } from '@/errors/EngineError/BaseError'
import {
  DuplicateSceneNodeError,
  IncompleteFramebufferError,
  InvalidGeometryError,
  InvalidTextureSourceError,
  InvalidVertexAttributeError,
  ProgramLinkError,
  RenderTargetUnavailableError,
  RenderingError,
  ResourceDisposedError,
  ResourceHasSceneReferencesError,
  ResourceSceneReferenceUnderflowError,
  SceneGraphCycleError,
  ShaderCompilationError,
  UnsupportedIndexTypeError,
  UnsupportedRenderFeatureError,
  UnsupportedShaderVariantError,
  WebGLBackendDisposedError,
  WebGLContextCreationError,
  WebGLContextLostError,
  WebGLResourceCreationError
} from '@/rendering/core/errors'

describe('RenderingError', () => {
  /**
   * 保护的错误实现：RenderingError 绕开既有 EngineError，导致日志和序列化协议分裂。
   */
  it('属于现有 EngineError 错误体系', () => {
    const error = new RenderingError('test failure', 'TEST_ERROR')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(EngineError)
    expect(error).toBeInstanceOf(RenderingError)
  })

  /**
   * 保护的错误实现：把两个 string 参数误按 `code, message` 传给 EngineError。
   */
  it('按照 message、code 的统一顺序保存基础错误信息', () => {
    const error = new RenderingError('test failure', 'TEST_ERROR')

    expect(error.message).toBe('test failure')
    expect(error.code).toBe('TEST_ERROR')
  })

  /**
   * 保护的错误实现：错误对象继续引用调用者的可变 details，事后丢失原始诊断现场。
   */
  it('复制并冻结 details，避免调用方随后修改诊断上下文', () => {
    const mutableDetails: Record<string, unknown> = {
      label: 'before'
    }

    const error = new RenderingError('test failure', 'TEST_ERROR', mutableDetails)

    mutableDetails.label = 'after'

    expect(error.name).toBe('RenderingError')
    expect(error.details).toEqual({
      label: 'before'
    })
    expect(Object.isFrozen(error.details)).toBe(true)
  })

  /**
   * 保护的错误实现：分别创建 context 和 details 两份对象，使两个错误 API 发生漂移。
   */
  it('让 EngineError.context 与 RenderingError.details 引用同一个冻结快照', () => {
    const error = new RenderingError(
      'WebGL failed to create buffer',
      'WEBGL_RESOURCE_CREATION_FAILED',
      {
        resourceKind: 'buffer',
        label: 'particle-position'
      }
    )

    expect(error.context).toBe(error.details)
    expect(error.context).toEqual({
      resourceKind: 'buffer',
      label: 'particle-position'
    })
    expect(Object.isFrozen(error.context)).toBe(true)
  })

  /**
   * 保护的错误实现：子类重新发明 recoverable 或 JSON 结构，破坏统一错误边界。
   */
  it('复用 EngineError 的 recoverable 和 toJSON 协议', () => {
    const error = new RenderingError('draw failed', 'TEST_ERROR', {
      operation: 'draw'
    })

    expect(error.recoverable).toBe(false)
    expect(error.toJSON()).toMatchObject({
      name: 'RenderingError',
      code: 'TEST_ERROR',
      message: 'draw failed',
      context: {
        operation: 'draw'
      },
      recoverable: false
    })
  })

  /**
   * 表驱动验证全部领域错误都保持真实运行时类型、独立 code 和统一冻结 details 协议。
   *
   * 任一子类误用裸 Error、错误 code 或第二份 details 对象都会让对应数据行失败。
   */
  it.each([
    {
      error: new ResourceDisposedError('Geometry'),
      code: 'RESOURCE_DISPOSED'
    },
    {
      error: new ResourceHasSceneReferencesError('Geometry', 2),
      code: 'RESOURCE_HAS_SCENE_REFERENCES'
    },
    {
      error: new ResourceSceneReferenceUnderflowError('Geometry'),
      code: 'RESOURCE_SCENE_REFERENCE_UNDERFLOW'
    },
    {
      error: new SceneGraphCycleError('root', 'child'),
      code: 'SCENE_GRAPH_CYCLE'
    },
    {
      error: new DuplicateSceneNodeError('mesh'),
      code: 'DUPLICATE_SCENE_NODE'
    },
    {
      error: new InvalidVertexAttributeError('position', 'itemSize must be positive'),
      code: 'INVALID_VERTEX_ATTRIBUTE'
    },
    {
      error: new InvalidGeometryError('position attribute is required'),
      code: 'INVALID_GEOMETRY'
    },
    {
      error: new WebGLResourceCreationError('buffer', 'particle-position'),
      code: 'WEBGL_RESOURCE_CREATION_FAILED'
    },
    {
      error: new WebGLContextCreationError('main-canvas'),
      code: 'WEBGL_CONTEXT_CREATION_FAILED'
    },
    {
      error: new WebGLContextLostError('draw'),
      code: 'WEBGL_CONTEXT_LOST'
    },
    {
      error: new WebGLBackendDisposedError('draw'),
      code: 'WEBGL_BACKEND_DISPOSED'
    },
    {
      error: new ShaderCompilationError('prt', 'vertex', 'compile log'),
      code: 'SHADER_COMPILATION_FAILED'
    },
    {
      error: new ProgramLinkError('prt', 'link log'),
      code: 'PROGRAM_LINK_FAILED'
    },
    {
      error: new UnsupportedShaderVariantError('prt', 'webgl1'),
      code: 'UNSUPPORTED_SHADER_VARIANT'
    },
    {
      error: new UnsupportedIndexTypeError('Uint32Array', 'OES_element_index_uint is unavailable'),
      code: 'UNSUPPORTED_INDEX_TYPE'
    },
    {
      error: new InvalidTextureSourceError('skybox', 'face dimensions differ'),
      code: 'INVALID_TEXTURE_SOURCE'
    },
    {
      error: new IncompleteFramebufferError(36054, 'shadow-target'),
      code: 'INCOMPLETE_FRAMEBUFFER'
    },
    {
      error: new RenderTargetUnavailableError('shadow-target', 'target is disposed'),
      code: 'RENDER_TARGET_UNAVAILABLE'
    },
    {
      error: new UnsupportedRenderFeatureError(
        'multiple-color-attachments',
        'WEBGL_draw_buffers is unavailable'
      ),
      code: 'UNSUPPORTED_RENDER_FEATURE'
    }
  ])('$code 使用独立的领域错误类型', ({ error, code }) => {
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(EngineError)
    expect(error).toBeInstanceOf(RenderingError)
    expect(error.name).toBe(error.constructor.name)
    expect(error.code).toBe(code)
    expect(error.message.length).toBeGreaterThan(0)
    expect(error.context).toBe(error.details)
    expect(Object.isFrozen(error.details)).toBe(true)
  })

  /**
   * 保护的错误实现：把稳定错误码写进 message，或把可读句子错误写进 code。
   */
  it('ResourceDisposedError 将可读文本作为 message，将稳定标识作为 code', () => {
    const error = new ResourceDisposedError('Geometry')

    expect(error.message).toBe('Geometry has been disposed')
    expect(error.code).toBe('RESOURCE_DISPOSED')
    expect(error.details).toEqual({
      resourceName: 'Geometry'
    })
  })

  /**
   * 保护的错误实现：
   *
   * - 丢失当前 Scene 引用数；
   * - 使用含糊的 RESOURCE_DISPOSED；
   * - message 没有说明资源为什么不能立即释放。
   */
  it('ResourceHasSceneReferencesError 保留资源类型和当前 Scene 引用数', () => {
    const error = new ResourceHasSceneReferencesError('Geometry', 2)

    expect(error.message).toBe('Geometry cannot be disposed while 2 Scene references remain')
    expect(error.code).toBe('RESOURCE_HAS_SCENE_REFERENCES')
    expect(error.details).toEqual({
      resourceName: 'Geometry',
      sceneReferenceCount: 2
    })
  })

  /**
   * 保护的错误实现：
   *
   * - 引用数为零时仍继续减少；
   * - 错误上下文没有记录触发下溢时的计数。
   */
  it('ResourceSceneReferenceUnderflowError 明确记录零引用下溢', () => {
    const error = new ResourceSceneReferenceUnderflowError('Geometry')

    expect(error.message).toBe(
      'Geometry cannot release a Scene reference because its Scene reference count is already zero'
    )
    expect(error.code).toBe('RESOURCE_SCENE_REFERENCE_UNDERFLOW')
    expect(error.details).toEqual({
      resourceName: 'Geometry',
      sceneReferenceCount: 0
    })
  })

  /**
   * 保护的错误实现：create-null 错误未记录 GPU 对象种类或调用方资源标签。
   */
  it('WebGL resource create-null 错误保留资源种类和调用方标签', () => {
    const error = new WebGLResourceCreationError('buffer', 'particle-position')

    expect(error.details).toEqual({
      resourceKind: 'buffer',
      label: 'particle-position'
    })
  })

  /**
   * 保护的错误实现：把 shader compile 与 program link 合并成缺少阶段信息的泛化错误。
   */
  it('shader compilation 与 program link 错误保留各自独立的诊断信息', () => {
    const compilationError = new ShaderCompilationError('prt', 'fragment', 'precision mismatch')
    const linkError = new ProgramLinkError('prt', 'varying mismatch')

    expect(compilationError.details).toEqual({
      shaderName: 'prt',
      stage: 'fragment',
      infoLog: 'precision mismatch'
    })
    expect(linkError.details).toEqual({
      shaderName: 'prt',
      infoLog: 'varying mismatch'
    })
  })

  /**
   * 保护的错误实现：framebuffer 错误只保留文本，丢失原始 WebGL status 或目标标签。
   */
  it('framebuffer completeness 错误保留 WebGL status 和目标标签', () => {
    const error = new IncompleteFramebufferError(36054, 'gbuffer')

    expect(error.details).toEqual({
      status: 36054,
      targetLabel: 'gbuffer'
    })
  })
})
