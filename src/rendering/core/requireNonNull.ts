/**
 * 将只可能以 `null` 表示失败的底层创建结果收窄为非 null 类型。
 *
 * @typeParam T - 创建成功时返回的值类型，例如 `WebGLBuffer`。
 * @param value - WebGL `create*()` 等 API 返回的 `T | null`。
 * @param errorFactory - 仅在 `value === null` 时调用的领域错误工厂。
 * @returns 与输入严格相同的非 null 值，保持对象身份不变。
 * @throws errorFactory 返回的同一个错误实例。
 *
 * @remarks
 * 该函数故意使用 `value === null`，不能改成宽泛的 falsy 判断，否则 `0`、`false`
 * 和空字符串等合法值会被错误拒绝。它只处理 create-null，不替代 shader compile、
 * program link、framebuffer completeness 或 context-lost 检查。
 */
export function requireNonNull<T>(value: T | null, errorFactory: () => Error): T {
  if (value === null) {
    throw errorFactory()
  }

  return value
}
