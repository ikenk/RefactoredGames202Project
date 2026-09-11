import { describe, expect, it } from 'vitest'

import { InvalidShaderModuleError, ResourceDisposedError } from '@/rendering/core/errors'
import { ShaderModule } from '@/rendering/resources/ShaderModule'

/**
 * ShaderModule 测试关注 CPU 逻辑资源的对外契约。
 *
 * @remarks
 * 本测试不会创建 WebGLShader 或 WebGLProgram。编译、链接及 context-local GPU
 * 缓存属于后续 WebGL1ShaderManager 的测试范围。
 */
describe('ShaderModule single-language CPU resource', () => {
  /**
   * 最小正常路径：一个 ShaderModule 只描述一种具体 shader language。
   *
   * 如果实现错误地恢复为“必须同时提供 WebGL1 和 WebGL2 两套源码”，这个测试会失败。
   */
  it('保存一个完整的 GLSL ES 1.00 shader module', () => {
    const shader = new ShaderModule({
      name: 'prt-forward',
      language: 'glsl-es-100',
      vertexSource: 'attribute vec3 aPosition;\nvoid main() {}',
      fragmentSource: 'precision mediump float;\nvoid main() {}'
    })

    expect(shader.name).toBe('prt-forward')
    expect(shader.language).toBe('glsl-es-100')
    expect(shader.vertexSource).toBe('attribute vec3 aPosition;\nvoid main() {}')
    expect(shader.fragmentSource).toBe('precision mediump float;\nvoid main() {}')
    expect(shader.builtInUniforms).toEqual({})
  })

  /**
   * WebGL2 用户自定义 shader 可以独立存在，不需要提供一个虚假的 WebGL1 版本。
   */
  it('允许单独创建 GLSL ES 3.00 shader module', () => {
    const shader = new ShaderModule({
      name: 'custom-webgl2',
      language: 'glsl-es-300',
      vertexSource: '#version 300 es\nvoid main() {}',
      fragmentSource: '#version 300 es\nprecision highp float;\nout vec4 color;\nvoid main() {}'
    })

    expect(shader.language).toBe('glsl-es-300')
    expect(shader.vertexSource).toContain('#version 300 es')
    expect(shader.fragmentSource).toContain('#version 300 es')
  })

  /**
   * built-in uniform binding 是构造时快照。
   *
   * 调用者后续修改原对象不能改变 ShaderModule 已保存的契约，否则不同 backend
   * 在不同时刻编译同一个 module 时可能观察到不同绑定。
   */
  it('复制并冻结 built-in uniform binding', () => {
    const input: {
      modelMatrix?: string
      viewMatrix?: string
    } = {
      modelMatrix: 'uModel',
      viewMatrix: 'uView'
    }

    const shader = new ShaderModule({
      name: 'built-in-bindings',
      language: 'glsl-es-100',
      vertexSource: 'void main() {}',
      fragmentSource: 'void main() {}',
      builtInUniforms: input
    })

    input.modelMatrix = 'uChangedModel'

    expect(shader.builtInUniforms).toEqual({
      modelMatrix: 'uModel',
      viewMatrix: 'uView'
    })
    expect(Object.isFrozen(shader.builtInUniforms)).toBe(true)
  })

  /**
   * 源码只使用 trim() 判断是否为空，不应删除用户源码中的换行和缩进。
   */
  it('验证源码非空但保留源码原始文本', () => {
    const vertexSource = '\n  void main() {}\n'

    const shader = new ShaderModule({
      name: 'preserve-source',
      language: 'glsl-es-100',
      vertexSource,
      fragmentSource: 'void main() {}'
    })

    expect(shader.vertexSource).toBe(vertexSource)
  })

  /**
   * name 是稳定的开发者诊断标签。纯空白名称无法提供有意义的编译错误上下文。
   */
  it('拒绝空白 shader name', () => {
    expect(
      () =>
        new ShaderModule({
          name: '   ',
          language: 'glsl-es-100',
          vertexSource: 'void main() {}',
          fragmentSource: 'void main() {}'
        })
    ).toThrow(InvalidShaderModuleError)
  })

  it.each([
    {
      field: 'vertexSource',
      vertexSource: '   ',
      fragmentSource: 'void main() {}'
    },
    {
      field: 'fragmentSource',
      vertexSource: 'void main() {}',
      fragmentSource: '\n\t'
    }
  ])('拒绝空白 $field', ({ vertexSource, fragmentSource }) => {
    expect(
      () =>
        new ShaderModule({
          name: 'invalid-source',
          language: 'glsl-es-100',
          vertexSource,
          fragmentSource
        })
    ).toThrow(InvalidShaderModuleError)
  })

  /**
   * TypeScript 联合类型是编译期防线；运行时仍可能收到 JavaScript 或反序列化数据。
   */
  it('拒绝运行时不支持的 shader language', () => {
    expect(
      () =>
        new ShaderModule({
          name: 'invalid-language',
          language: 'spir-v' as 'glsl-es-100',
          vertexSource: 'void main() {}',
          fragmentSource: 'void main() {}'
        })
    ).toThrow(InvalidShaderModuleError)
  })

  /**
   * built-in uniform 名称同样用于运行时 lookup，空字符串没有合法含义。
   */
  it('拒绝空白 built-in uniform 名称', () => {
    expect(
      () =>
        new ShaderModule({
          name: 'invalid-binding',
          language: 'glsl-es-100',
          vertexSource: 'void main() {}',
          fragmentSource: 'void main() {}',
          builtInUniforms: {
            modelMatrix: '   '
          }
        })
    ).toThrow(InvalidShaderModuleError)
  })

  /**
   * JavaScript、JSON 或错误的类型断言可能绕过 BuiltInUniformBindings。
   *
   * 如果生产代码只遍历已知 semantic、却不检查输入的实际 key，
   * `modelMatix` 这类拼写错误就会被静默忽略。
   */
  it('拒绝未知 built-in uniform semantic', () => {
    expect(
      () =>
        new ShaderModule({
          name: 'misspelled-binding',
          language: 'glsl-es-100',
          vertexSource: 'void main() {}',
          fragmentSource: 'void main() {}',
          builtInUniforms: {
            modelMatix: 'uModel'
          } as unknown as {
            modelMatrix?: string
          }
        })
    ).toThrow(InvalidShaderModuleError)
  })

  /**
   * ShaderModule.dispose() 只清除 CPU 源码。
   *
   * 后续 Manager 将通过 Resource.onDispose() 删除当前 context 中的 WebGLProgram。
   */
  it('释放后禁止读取 CPU shader source 和 binding', () => {
    const shader = new ShaderModule({
      name: 'disposable-shader',
      language: 'glsl-es-100',
      vertexSource: 'void main() {}',
      fragmentSource: 'void main() {}'
    })

    shader.dispose()

    expect(shader.disposed).toBe(true)
    expect(() => shader.vertexSource).toThrow(ResourceDisposedError)
    expect(() => shader.fragmentSource).toThrow(ResourceDisposedError)
    expect(() => shader.builtInUniforms).toThrow(ResourceDisposedError)
  })
})
