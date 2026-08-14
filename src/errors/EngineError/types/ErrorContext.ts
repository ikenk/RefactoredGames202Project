/**
 * 引擎错误携带的附加上下文。
 *
 * 错误创建方可以记录任意类型的上下文值，但读取方必须先确认具体类型，
 * 避免错误处理代码因为错误的类型假设再次抛出异常。
 *
 * `Readonly` 只禁止通过该类型修改最外层属性，不会递归冻结内部对象，
 * 也不会在运行时调用 Object.freeze()。
 */
export type ErrorContext = Readonly<Record<string, unknown>>
