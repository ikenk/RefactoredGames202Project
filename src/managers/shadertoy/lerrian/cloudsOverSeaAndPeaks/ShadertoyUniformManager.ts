import { logger } from '@/logging/Logger'
import { RenderManager } from '@/managers/types/RenderManager'
import { UniformType } from '@/materials/types/Material'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { FrameContext } from '@/renderers/types/FrameContext'

export class ShadertoyUniformManager implements RenderManager {
  public readonly name: string = 'shadertoyUniformsManager'

  private renderer: BaseRenderer
  private canvas: HTMLCanvasElement

  private canvaLastWidth = 0
  private canvasLastHeight = 0
  /** 渲染分辨率缩放比例，默认 1.0（全分辨率） */
  private _scale: number = 1.0

  // 是否发生过交互
  private hasInteracted = false
  // 鼠标当前状态
  private mouseX = 0
  private mouseY = 0
  private mouseClickX = 0
  private mouseClickY = 0
  // 鼠标拖拽状态
  private isDragging = false
  private dragStartX = 0
  private dragStartY = 0
  private dragBaseX = 0 // 拖拽开始时的累积值
  private dragBaseY = 0
  // 累积的拖拽位置（传给 iMouse.zw）
  private accumulatedX = 0
  private accumulatedY = 0

  // mousedown 记录拖拽起点，mousemove 时累加增量，mouseup 结束拖拽
  private onMouseDown: (e: MouseEvent) => void
  private onMouseMove: (e: MouseEvent) => void
  private onMouseUp: (e: MouseEvent) => void
  // private onResize: () => void

  constructor(renderer: BaseRenderer, canvas: HTMLCanvasElement) {
    this.renderer = renderer
    this.canvas = canvas

    // 初始化 iResolution
    renderer.updateMaterialUniforms({
      iResolution: {
        type: UniformType.THREE_FV,
        value: [canvas.width * this._scale, canvas.height * this._scale, 1.0]
      }
    })

    // 鼠标点击（按下）监听函数
    this.onMouseDown = (e: MouseEvent) => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      // clientX - rect.left 是 CSS 像素，乘 dpr 转成物理像素（和 canvas.width/height 对齐）
      this.mouseClickX = (e.clientX - rect.left) * dpr
      this.mouseClickY = canvas.height - (e.clientY - rect.top) * dpr
      // 修改交互状态为“已交互”
      this.hasInteracted = true
      // 转换当前的拖动状态
      this.isDragging = true
      // 记录拖拽起点（屏幕像素）
      this.dragStartX = this.mouseClickX
      this.dragStartY = this.mouseClickY
    }

    // 鼠标移动监听函数
    this.onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      // clientX - rect.left 是 CSS 像素，乘 dpr 转成物理像素（和 canvas.width/height 对齐）
      this.mouseX = (e.clientX - rect.x) * dpr
      this.mouseY = canvas.height - (e.clientY - rect.top) * dpr // Y 翻转，GLSL 的 (0,0) 在左下

      // 累积值 = 拖拽前的基础值 + 本次拖拽的增量
      this.accumulatedX = this.dragBaseX + this.mouseX - this.dragStartX
      this.accumulatedY = this.dragBaseY + this.mouseY - this.dragStartY

      logger.debug(this.accumulatedX, this.accumulatedY)
    }

    // 鼠标抬起监听函数
    this.onMouseUp = (_: MouseEvent) => {
      // 转换当前的拖动状态
      this.isDragging = false
      this.dragBaseX = this.accumulatedX
      this.dragBaseY = this.accumulatedY
    }

    // 窗口 resize 时调用
    // this.onResize = () => {
    // this.renderer.updateMaterialUniforms({
    //   iResolution: {
    //     type: UniformType.THREE_FV,
    //     value: [this.canvas.width, this.canvas.height, 1.0]
    //   }
    // })
    // }

    // 监听鼠标点击（按下）
    canvas.addEventListener('mousedown', this.onMouseDown)
    // 监听鼠标移动
    canvas.addEventListener('mousemove', this.onMouseMove)
    // 监听鼠标抬起
    canvas.addEventListener('mouseup', this.onMouseUp)
    // 此处添加 resize 事件监听可能会存在 handler 函数执行顺序问题，即可能会出现该处的 handler 先注册，而引擎的 resize 事件的 handler 后注册的情况，由于 canvas width/height 的改变全在引擎的 resize 事件的 handler 中执行，因此这种情况一旦发生，就会造成该处的 handler 无法拿到当前的 canvas width/height 问题，因此不太适合在此处注册该事件监听
    // 监听窗口 resize 事件
    // window.addEventListener('resize', this.onResize)
  }

  update(context: FrameContext): void {
    // iResolution：使用缩放后的分辨率
    const w = Math.floor(this.canvas.width * this._scale)
    const h = Math.floor(this.canvas.height * this._scale)

    // iResolution：只在尺寸变化时更新
    if (this.canvaLastWidth !== this.canvas.width || this.canvasLastHeight !== this.canvas.height) {
      this.canvaLastWidth = w
      this.canvasLastHeight = h
      this.updateUniformResolution()
    }

    // iTime + iMouse：每帧更新
    this.renderer.updateMaterialUniforms({
      iTime: { type: UniformType.ONE_F, value: context.elapsedTime },
      iMouse: {
        type: UniformType.FOUR_FV,
        value: [
          // this.mouseX * this._scale,
          // this.mouseY * this._scale,
          this.accumulatedX * this._scale,
          this.accumulatedY * this._scale,
          this.hasInteracted ? 1.0 : 0.0, // z: 交互标记
          this.hasInteracted ? 1.0 : 0.0 // w: 交互标记
        ]
      }
    })
  }

  private updateUniformResolution() {
    this.renderer.updateMaterialUniforms({
      iResolution: {
        type: UniformType.THREE_FV,
        value: [this.canvaLastWidth, this.canvasLastHeight, 1.0]
      }
    })
  }

  /** 由外部（比如 LowResRenderPass）设置 */
  set scale(value: number) {
    this._scale = value
  }

  dispose(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    // window.removeEventListener('resize', this.onResize)
  }
}
