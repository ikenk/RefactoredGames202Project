import { Resource } from '@/rendering/core/Resource'
import { InvalidShaderModuleError } from '@/rendering/core/errors'

/**
 * 当前架构明确支持的 WebGL shader language。
 *
 * @remarks
 * 一个 ShaderModule 只能选择其中一种语言。它不要求调用者同时提供 WebGL1 和
 * WebGL2 两个版本。
 */
export type WebGLShaderLanguage = 'glsl-es-100' | 'glsl-es-300'

/** 两种语言版本共享的 ShaderModule 构造字段。 */
interface ShaderModuleBaseOptions {
  /**
   * 稳定、可读的诊断名称。
   *
   * @remarks
   * name 不依赖 constructor.name，也不充当 GPU cache key。Manager 应使用
   * ShaderModule 对象身份作为 cache key。
   */
  readonly name: string

  /** 完整 vertex shader 源码。 */
  readonly vertexSource: string

  /** 完整 fragment shader 源码。 */
  readonly fragmentSource: string

  /** 可选的 Engine 内建 uniform 名称映射。 */
  readonly builtInUniforms?: BuiltInUniformBindings
}

/** GLSL ES 1.00 ShaderModule。 */
export interface GLSLES100ShaderModuleOptions extends ShaderModuleBaseOptions {
  readonly language: 'glsl-es-100'
}

/** GLSL ES 3.00 ShaderModule。 */
export interface GLSLES300ShaderModuleOptions extends ShaderModuleBaseOptions {
  readonly language: 'glsl-es-300'
}

/**
 * ShaderModule 构造输入是互斥联合。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][shader-module-single-language]
 *
 * 一个实例在任意时刻只表示一种完整 shader language。WebGL2 用户自定义 shader
 * 可以直接构造 `language: 'glsl-es-300'` 的实例，不需要伪造 WebGL1 源码或传入
 * null。未来若一个内建材质需要同时管理两种版本，应由更高层 ShaderFamily 或工厂
 * 组合两个 ShaderModule，而不是让单个 ShaderModule 同时拥有多个身份。
 */
export type ShaderModuleOptions = GLSLES100ShaderModuleOptions | GLSLES300ShaderModuleOptions

const BUILT_IN_UNIFORM_SEMANTICS = [
  'modelMatrix',
  'viewMatrix',
  'projectionMatrix',
  'normalMatrix',
  'cameraPosition'
] as const

export type BuiltInUniformSemantic = (typeof BUILT_IN_UNIFORM_SEMANTICS)[number]

/**
 * 运行时验证用的允许集合。
 *
 * @remarks
 * TypeScript 联合类型在编译后会消失，Set 则用于拒绝来自 JavaScript、
 * JSON 或错误类型断言的未知 semantic key。
 */
const BUILT_IN_UNIFORM_SEMANTIC_SET: ReadonlySet<string> = new Set(BUILT_IN_UNIFORM_SEMANTICS)

/**
 * Engine 可以自动注入的内建 uniform 语义到实际 GLSL 名称的映射。
 *
 * @remarks
 * ShaderModule 不直接保存 WebGLUniformLocation。location 与 WebGLProgram 和
 * WebGL context 绑定，由后续 WebGLShaderManager 解析及缓存。
 *
 * @example
 * ```ts
 * const bindings: BuiltInUniformBindings = {
 *   modelMatrix: 'uModel',
 *   viewMatrix: 'uView'
 * }
 * ```
 */
export type BuiltInUniformBindings = Readonly<Partial<Record<BuiltInUniformSemantic, string>>>

/** 为无效或空白名称生成仍然可读的错误标签。 */
function getShaderDiagnosticLabel(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return '<unnamed>'
  }

  return name
}

/**
 * 验证必需文本不是空字符串，同时保留原始文本。
 *
 * @remarks
 * 对 shader source 调用 trim() 只用于验证，不能把 trim 后的结果保存下来，
 * 否则会擅自修改行号、缩进和用户用于诊断的源代码。
 */
function requireNonBlankText(shaderName: string, fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidShaderModuleError(shaderName, `${fieldName} must be a non-empty string`, {
      fieldName
    })
  }

  return value
}

/**
 * 复制并冻结 ShaderModule 的内建 uniform 映射。
 */
function createBuiltInUniformSnapshot(
  shaderName: string,
  bindings: BuiltInUniformBindings | undefined
): Readonly<BuiltInUniformBindings> {
  if (bindings === undefined) {
    return Object.freeze({})
  }

  if (bindings === null || typeof bindings !== 'object') {
    throw new InvalidShaderModuleError(
      shaderName,
      'builtInUniforms must be an object when provided'
    )
  }

  for (const semantic of Object.keys(bindings)) {
    if (!BUILT_IN_UNIFORM_SEMANTIC_SET.has(semantic)) {
      throw new InvalidShaderModuleError(
        shaderName,
        `unsupported built-in uniform semantic ${semantic}`,
        {
          semantic
        }
      )
    }
  }

  const snapshot: Partial<Record<BuiltInUniformSemantic, string>> = {}

  for (const semantic of BUILT_IN_UNIFORM_SEMANTICS) {
    const uniformName = bindings[semantic]

    if (uniformName === undefined) continue

    snapshot[semantic] = requireNonBlankText(shaderName, `builtInUniforms.${semantic}`, uniformName)
  }

  return Object.freeze(snapshot)
}

/**
 * 不含 WebGL handle 的单语言 shader CPU 资源。
 *
 * @remarks
 * [DESIGN-WEIGHT:3][shader-module-cpu-gpu-boundary]
 *
 * ShaderModule 只保存：
 *
 * - 一种明确的 GLSL language；
 * - 一份 vertex source；
 * - 一份 fragment source；
 * - 可选的逻辑 built-in uniform binding。
 *
 * 它不编译 shader、不链接 program，也不保存 WebGLShader、WebGLProgram 或
 * WebGLUniformLocation。同一个 ShaderModule 可以由不同 context 的 Manager 分别
 * 编译成互不共享的 GPU program。
 */
export class ShaderModule extends Resource {
  /** 不依赖 constructor.name 的稳定资源诊断类型。 */
  protected readonly resourceType = 'ShaderModule'

  /** 面向开发者的稳定诊断名称。 */
  public readonly name: string

  /** 当前实例唯一对应的 shader language。 */
  public readonly language: WebGLShaderLanguage

  /** 释放时会被清空的 vertex source。 */
  private vertexSourceValue: string | null

  /** 释放时会被清空的 fragment source。 */
  private fragmentSourceValue: string | null

  /** 释放时会被清空的 built-in uniform binding snapshot。 */
  private builtInUniformsValue: BuiltInUniformBindings | null

  /**
   * 创建一个单语言 ShaderModule。
   *
   * @throws {@link InvalidShaderModuleError}
   * name、源码、language 或 built-in uniform binding 无效时抛出。
   */
  constructor(options: ShaderModuleOptions) {
    super()

    const shaderName = getShaderDiagnosticLabel(options.name)

    this.name = requireNonBlankText(shaderName, 'name', options.name)

    const language: unknown = (
      options as {
        readonly language?: unknown
      }
    ).language

    if (language !== 'glsl-es-100' && language !== 'glsl-es-300') {
      throw new InvalidShaderModuleError(
        shaderName,
        `unsupported shader language ${String(language)}`,
        {
          language
        }
      )
    }

    this.language = language
    this.vertexSourceValue = requireNonBlankText(shaderName, 'vertexSource', options.vertexSource)
    this.fragmentSourceValue = requireNonBlankText(
      shaderName,
      'fragmentSource',
      options.fragmentSource
    )
    this.builtInUniformsValue = createBuiltInUniformSnapshot(shaderName, options.builtInUniforms)
  }

  /** 获取完整 vertex shader source。 */
  get vertexSource(): string {
    this.assertUsable()

    return this.vertexSourceValue!
  }

  /** 获取完整 fragment shader source。 */
  get fragmentSource(): string {
    this.assertUsable()

    return this.fragmentSourceValue!
  }

  /** 获取冻结的 built-in uniform binding snapshot。 */
  get builtInUniforms(): BuiltInUniformBindings {
    this.assertUsable()

    return this.builtInUniformsValue!
  }

  /**
   * 断开对 shader source 和 binding snapshot 的 CPU 引用。
   *
   * @remarks
   * WebGL program 清理由订阅该 Resource 的各个 context-local Manager 完成。
   */
  protected disposeCPUData(): void {
    this.vertexSourceValue = null
    this.fragmentSourceValue = null
    this.builtInUniformsValue = null
  }
}
