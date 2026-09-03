/**
 * 渲染阶段可借用的输出目标。
 *
 * 第一阶段只暴露 renderer 完成绑定所需的最小信息：
 * - WebGLFramebuffer：像素真正写入的底层对象；
 * - width / height：进入目标后应该设置的 viewport。
 *
 * 有意不暴露的能力：
 * - dispose：绑定者不是资源所有者，绝不能通过本接口释放目标；
 * - resize：尺寸变更仍由创建并拥有目标的 pass 负责；
 * - texture attachments：后续 pass 通过具体 GBufferFBO 的只读 getter 借用，
 *   不是通过通用 RenderTargetScope 获取。
 *
 * 和 three.js 的联系：
 * three.js WebGLRenderTarget 同样表示“输出目标 + 尺寸 + attachments”，
 * 而不是把裸 framebuffer 交给 Mesh。这里先只抽取第一阶段真实需要的最窄部分。
 *
 * 和 three.js 的区别：
 * three.js 的 framebuffer 是 renderer 内部创建和缓存的；当前工程的 FBO
 * 已经创建了 WebGLFramebuffer，所以第一阶段暂时读取现有句柄。第三阶段
 * backend 边界建立后，这个底层句柄不应继续暴露在高层接口中。
 */
export interface RenderTarget {
  /**
   * 返回当前有效的底层 framebuffer。
   *
   * 当前 FBO.getFrameBuffer() 返回 nullable；WebGLRenderer 会在绑定前检查 null，
   * 避免 disposed target 被静默解释成默认 framebuffer。
   */
  getFrameBuffer(): WebGLFramebuffer | null

  /** 目标实际像素宽度，用于 viewport。 */
  getWidth(): number

  /** 目标实际像素高度，用于 viewport。 */
  getHeight(): number
}
