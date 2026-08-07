import { getCapabilities } from '@/_config/glCapabilities'
/**
 * 解绑当前 VAO，回到默认 VAO（编号 0）
 *
 * 👉 职责：
 * - 把后续所有顶点属性槽位操作导向「默认 VAO」这张没人绘制的表
 *
 * ❗ 使用约定：
 * - 任何**绕过 Mesh 直接操作顶点属性槽位**的代码（直接调用
 *   vertexAttribPointer / enable(disable)VertexAttribArray 的地方），
 *   必须在动手之前调用本函数
 * - 否则它会把自己的 enable / disable 写进某个 Mesh 的 VAO，破坏那个 Mesh 的状态
 *
 * 👉 当前需要调用它的位置：
 * - src/textures/cubemap/shared/drawCube.ts
 * - src/textures/converters/convertHDRToCubeMap.ts
 *
 * ⚠️ 扩展缺失时静默跳过（用可选链）：
 * - 缺 VAO 扩展时 Mesh 会 fail-fast 抛错，轮不到这里报
 */
export function unbindVAO(): void {
  getCapabilities().vertexArrayObject?.bindVertexArrayOES(null)
}
