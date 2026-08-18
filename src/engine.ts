import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { logger } from '@/logging/Logger'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { CameraConfig } from './scenes/types/SceneConfig'
import { PerformanceMonitor } from '@/monitors/PerformanceMonitor'

import { getCapabilities, initCapabilities } from './_config/glCapabilities'
import { getClampedDPR } from './utils/platform'

import { FrameClock } from './renderers/FrameClock'
import { Updatable } from './animators/types/Updatable'

import { WebGLNotSupportedError } from './errors/EngineError/WebGLError/WebGLNotSupportedError'
import { WebGLExtensionError } from './errors/EngineError/WebGLError/WebGLExtensionError'
import { WebGLContextLostError } from './errors/EngineError/WebGLError/WebGLContextLostError'

import { SceneContext } from './scenes/types/SceneContext'
import { loadAxes } from './scenes/axes/loadAxes'
import { SceneLoader } from './types/engine'

export class Engine {
  // 上下文属性
  private gl: WebGLRenderingContext

  // 相机相关属性
  public camera: PerspectiveCamera
  private cameraControls: OrbitControls

  /**
   * 帧时钟（FrameClock）：唯一负责构建 {@link FrameContext} 的生产者。
   *
   * 收拢了原本散落在 WebGLRenderer 里的 startTime / lastTime / frameCount，
   * 每帧在 mainLoop 顶部调用一次 `tick()`，在「帧边界（frame boundary）」产出
   * 本帧上下文，供 update 阶段（updaters）与 render 阶段（renderer）共享。
   *
   * private：帧上下文的生命周期由 Engine 独占管理，外部不应直接触碰。
   */
  private frameClock: FrameClock

  /**
   * 帧级更新器列表（per-frame updaters）。
   *
   * 每个 {@link Updatable} 在 **render 之前** 修改场景级可变状态——
   * 典型是相机运镜（如 CameraOrbitAnimator），也可用于灯光动画、全局参数缓动。
   *
   * 与 RenderManager 的分工：
   * - RenderManager 挂在单个 BaseRenderer 上，更新「某个物体自己」的 GPU 资源
   * - Updatable 由 Engine 直接驱动，更新「不依附于任何 renderer」的场景级对象（相机等）
   *
   * 注册入口：engine.addUpdater(u) / engine.removeUpdater(u)
   */
  private updaters: Updatable[] = []

  /**
   * 渲染器（WebGLRenderer）：纯粹的 RenderPass 调度器（dispatcher）。
   *
   * 自身不持有场景数据，只按注册顺序遍历执行各 RenderPass（Shadow / GBuffer /
   * SSR / Forward / Overlay…）。每帧由 mainLoop 调用 `render(frameContext)`，
   * 把同一帧的 {@link FrameContext} 透传给每个 pass。
   *
   * public：场景 loader（loadXxxScene）需要通过它 addRenderPass / clearRenderPasses。
   */
  public renderer: WebGLRenderer

  // 性能监测
  private perfMonitor: PerformanceMonitor

  /**
   * 静态工厂（static factory）：组装一个就绪的 Engine 实例。
   *
   * 为什么用静态工厂而非直接 new：
   * - 构造前需要一串「有先后依赖」的同步准备（canvas 尺寸 → GL 上下文 → viewport →
   *   相机 → 渲染器…），这些不适合塞进构造函数；
   * - 构造函数被设为 private，强制外部只能走 create()，保证实例一定是「准备完整」的。
   *
   * 👉 装配顺序（顺序敏感，不可随意调换）：
   * 1. setupCanvas(canvas)        —— 按 DPR 设定 drawingBuffer / CSS 尺寸
   * 2. initGL(canvas)             —— 取 WebGL 上下文 + 激活扩展 + 必需扩展 fail-fast
   * 3. setupGLViewport(canvas,gl) —— gl.viewport 铺满 framebuffer
   * 4. setupCamera(canvas, {...}) —— 透视相机 + OrbitControls（含可选 autoRotate）
   * 5. new FrameClock(gl)         —— 帧时钟，后续每帧产出 FrameContext
   * 6. initRenderer(gl, camera)   —— WebGLRenderer（纯 pass 调度器）
   * 7. initGUI()                  —— dat.GUI 根容器
   * 8. initPerformanceMonitor(gl) —— FPS / GPU 计时
   * 9. setupResizeHandler(...)    —— 注册 window 'resize' 同步 canvas/viewport/aspect
   * 10. new Engine(...)           —— 把以上产物注入私有构造函数
   *
   * ❗ 注意：
   * - 本方法是「同步」的，只做装配；异步内容（加载场景资源）由 init() / loadScene() 负责
   * - 任一步骤抛错（如 WebGL 不支持 / 缺扩展）会直接向上抛，调用方需 try/catch
   *
   * @param canvas 已确认非 null 的目标画布（判空 narrowing 由调用方在外层完成）
   * @returns 装配完成、可立即 await init() 的 Engine 实例
   */
  static create(canvas: HTMLCanvasElement): Engine {
    // ----- 设置 canvas 参数 -----
    Engine.setupCanvas(canvas)

    // ----- 初始化上下文 -----
    const gl = Engine.initGL(canvas)

    // ----- 初始化 gl viewport -----
    Engine.setupGLViewport(canvas, gl)

    // ----- 初始化相机 & 控制器 -----
    const { camera, controls: cameraControls } = Engine.setupCamera(canvas, {
      position: [0, 0, 100],
      target: [0, 0, 0]
      // autoRotate: true,
      // autoRotateSpeed: 2.0
    })

    // ----- 帧时钟 -----
    const frameClock = new FrameClock(gl)

    // ----- 初始化渲染器 -----
    const renderer = Engine.initRenderer(gl, camera)

    // ----- 初始化性能检测器 -----
    const perfMonitor = Engine.initPerformanceMonitor(gl)

    // ----- 窗口变化应对方法 -----
    Engine.setupResizeHandler(canvas, gl, camera)

    const engine = new Engine(gl, camera, cameraControls, frameClock, renderer, perfMonitor)

    return engine
  }

  /**
   * 私有构造函数（private constructor）：仅做依赖注入式的字段赋值。
   *
   * 设为 private 的原因：禁止外部 `new Engine(...)`，强制走 {@link Engine.create}，
   * 确保传入的每个依赖都已由 create() 按正确顺序准备好（fully-constructed）。
   * 因此这里不做任何初始化逻辑，只是把现成的依赖存进实例字段。
   *
   * @param gl             已校验、扩展已激活的 WebGL 上下文
   * @param camera         主透视相机
   * @param cameraControls 轨道控制器（OrbitControls），每帧由 mainLoop 同步
   * @param frameClock     帧时钟，每帧产出 FrameContext
   * @param renderer       RenderPass 调度器
   * @param gui            dat.GUI 根实例
   * @param perfMonitor    性能监视器
   */
  private constructor(
    gl: WebGLRenderingContext,
    camera: PerspectiveCamera,
    cameraControls: OrbitControls,
    frameClock: FrameClock,
    renderer: WebGLRenderer,
    perfMonitor: PerformanceMonitor
  ) {
    this.gl = gl
    this.camera = camera
    this.cameraControls = cameraControls
    this.frameClock = frameClock
    this.renderer = renderer
    this.perfMonitor = perfMonitor

    logger.info('✅ Class Engine has initialized')
  }

  /**
   * 初始化 WebGL 上下文 + 一站式启用扩展 + 必需扩展校验
   *
   * 👉 步骤：
   * 1. canvas.getContext('webgl') 取上下文
   * 2. 设置 sRGB drawingBufferColorSpace（让默认 framebuffer 输出走 sRGB 编码）
   * 3. initCapabilities(gl) — 一次性查询并激活所有用到的扩展（详见 glCapabilities.ts）
   * 4. fail-fast：必需扩展缺失 → throw WebGLExtensionError
   *      - OES_element_index_uint     ← FFT 海面 mesh > 65535 顶点必需
   *      - OES_texture_float_linear   ← float 纹理 LINEAR 采样必需（FFT 输出 / IBL）
   * 5. 注册 webglcontextlost 监听（GPU 重置 / 切显卡时回调）
   *
   * 👉 与 glCapabilities 的分工：
   * - glCapabilities：只查询、只标注 boolean，不抛错
   * - 本函数：根据 caps.xxx 做"必需 vs 可选"的语义判断，缺必需就 fail-fast
   *
   * ❗ 扩展激活的副作用：
   * - gl.getExtension 是"查询 + 激活"二合一；只要 initCapabilities 调过，
   *   后续任何模块 import 后用 #extension 指令的 shader 都能正确链接
   */
  private static initGL(canvas: HTMLCanvasElement): WebGLRenderingContext {
    const gl = canvas.getContext('webgl')

    if (!gl) {
      alert('Unable to initialize WebGL. Your browser or machine may not support it.')
      // throw new Error('Unable to initialize WebGL. Your browser or machine may not support it.')
      throw new WebGLNotSupportedError()
    }

    // 设置颜色空间
    gl.drawingBufferColorSpace = 'srgb'

    // 一次性激活所有扩展 + 收集硬件上限（详细列表见 glCapabilities.ts）
    initCapabilities(gl)

    const caps = getCapabilities()

    // ---- 必需扩展（缺则 fail-fast）----
    // 以下扩展只在 WebGL1 中需要显式启用；在 WebGL2 中都是默认可用的
    if (!caps.elementIndexUint) {
      // 突破 65535 顶点上限，FFT 海面 1024x1024 mesh 必需
      throw new WebGLExtensionError('OES_element_index_uint')
    }
    // 允许对浮点纹理使用线性过滤（LINEAR），否则只能 NEAREST
    if (!caps.floatLinearFilter) {
      // float 纹理 LINEAR 采样，FFT 输出 / IBL prefilter 必需
      throw new WebGLExtensionError('OES_texture_float_linear')
    }

    // 查询最大纹理单元
    const maxTexImgUnits = caps.maxFragmentTextureUnits
    logger.debug('MAX_TEXTURE_IMAGE_UNITS:', maxTexImgUnits)

    // 监听上下文丢失
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      throw new WebGLContextLostError()
    })

    return gl
  }

  /**
   * 创建并配置透视相机 (PerspectiveCamera) + 轨道控制器 (OrbitControls)
   *
   * 👉 步骤：
   * 1. 读 config.fov / near / far，按 canvas.width / canvas.height 算 aspect 比，构造透视相机
   * 2. camera.position.set(...config.position) —— 设初始位置
   * 3. 挂 OrbitControls 到 canvas，配缩放 (zoom) / 旋转 (rotate) / 平移 (pan) 速度
   *    （艺术量，按需调；当前默认值 1.0 / 0.3 / 0.8）
   * 4. controls.target.set(...config.target) —— 设焦点
   * 5. controls.update() —— 把 target / position 应用到 OrbitControls 内部状态
   * 6. 若 config.autoRotate 为真 —— 开启 controls.autoRotate 并设 autoRotateSpeed
   *
   * ❗ 顺序敏感：
   * - controls.target.set 必须在 camera.position.set 之后调用，且参数不能为
   *   null / undefined，否则 OrbitControls 会反过来覆盖 camera.position
   *
   * @param canvas 用于计算 aspect 和承接鼠标事件 (mouse event) 的画布
   * @param config 相机参数：fov / near / far / position [x,y,z] / target [x,y,z]
   * @returns      { camera, controls }，外层 Engine 持有引用以驱动主循环 (main loop)
   */
  private static setupCamera(
    canvas: HTMLCanvasElement,
    config: CameraConfig
  ): { camera: PerspectiveCamera; controls: OrbitControls } {
    const aspect = canvas.width / canvas.height
    const camera = new PerspectiveCamera(config.fov, aspect, config.near, config.far)
    camera.position.set(...config.position)

    // 初始化相机控制器
    const controls = new OrbitControls(camera, canvas)
    // 设置更小的最小距离，允许更近的放大
    controls.minDistance = config.near ?? 0.1 // 或者更小的值
    controls.maxDistance = config.far ?? 1000 // 设置合理的最大距离
    // 启用鼠标缩放，缩放速度为 1.0 倍标准速度
    controls.enableZoom = true
    controls.zoomSpeed = 1.0
    // 启用鼠标旋转，旋转速度为 0.3 倍标准速度
    controls.enableRotate = true
    controls.rotateSpeed = 0.3
    // 启用鼠标平移，平移速度为 0.8 倍标准速度
    controls.enablePan = true
    controls.panSpeed = 0.8
    // cameraControls.target.set 必须在 camera.position.set 之后执行，而且参数不能为 null 或者 undefined，否则会影响 camera.position 中的值
    controls.target.set(...config.target)
    controls.update()

    if (config.autoRotate) {
      controls.autoRotate = true
      controls.autoRotateSpeed = config.autoRotateSpeed ?? 2.0
    }

    return { camera, controls }
  }

  /**
   * 初始化渲染器 (WebGLRenderer) 实例
   *
   * 👉 职责：
   * - 仅做 new WebGLRenderer(gl, camera)，把 GL 上下文与相机注入渲染器
   * - 渲染管线 (render pass) 与各资源管理器 (manager) 由 Engine.init() 阶段
   *   在 await 之后再通过 addRender / addManager 挂载
   *
   * @param gl     已通过 initGL 校验、扩展已激活的 WebGLRenderingContext
   * @param camera 主相机，渲染器内部读取其 viewMatrix / projectionMatrix
   * @returns      WebGLRenderer 实例
   */
  private static initRenderer(gl: WebGLRenderingContext, camera: PerspectiveCamera): WebGLRenderer {
    const renderer = new WebGLRenderer(gl, camera)
    return renderer
  }

  /**
   * 初始化性能监视器 (PerformanceMonitor)
   *
   * 👉 职责：
   * - 创建 PerformanceMonitor 实例，用于在 mainLoop 中每帧采样 FPS / GPU 时间
   * - 内部细节（如 EXT_disjoint_timer_query_webgl2 扩展可用性、UI 注入等）
   *   封装在 PerformanceMonitor 自身，不暴露给 Engine
   *
   * @param gl 用于内部查询硬件计时扩展 (timer query extension) 的 GL 上下文
   * @returns  PerformanceMonitor 实例；每帧由 mainLoop 调用 .update()
   */
  private static initPerformanceMonitor(gl: WebGLRenderingContext): PerformanceMonitor {
    const perfMonitor = new PerformanceMonitor(gl)
    return perfMonitor
  }

  /**
   * 配置 canvas 的「显示尺寸 (CSS size)」与「绘图缓冲区尺寸 (drawing buffer size)」
   *
   * 👉 步骤：
   * 1. getClampedDPR() —— 取设备像素比 (device pixel ratio, DPR)，
   *    对超高 DPR 设备做上限截断 (clamp)，避免显存 (VRAM) 爆涨
   * 2. 显示尺寸 (CSS)：window.innerWidth × window.innerHeight，让 canvas 占满视口 (viewport)
   * 3. 绘图缓冲区尺寸：CSS 尺寸 × DPR，保证在 Retina 等高 DPR 屏上不糊
   *
   * 📐 公式：
   *   canvas.width  (drawingBuffer) = displayWidth  × DPR     [device px]
   *   canvas.height (drawingBuffer) = displayHeight × DPR     [device px]
   *   canvas.style.width / height   = displayWidth / height   [css px]
   *
   * ❗ 不出现滚动条 (scrollbar) 的关键：
   * - 用 window.innerWidth / innerHeight 而非 document.body.clientWidth / clientHeight
   * - 后者会在 body 存在 padding / border 时把 canvas 撑出视口
   *
   * @param canvas 要被尺寸化的目标画布
   */
  private static setupCanvas(canvas: HTMLCanvasElement) {
    const clampedDPR = getClampedDPR()

    // 不出现滚动条的做法：使用元素自身的 clientWidth/clientHeight，这能确保 Canvas 的显示尺寸严格在其父容器范围内
    const displayWidth = window.innerWidth
    const displayHeight = window.innerHeight

    // 绘图缓冲区 = 视口尺寸 × DPR
    canvas.width = displayWidth * clampedDPR
    canvas.height = displayHeight * clampedDPR

    // CSS显示尺寸 = 视口尺寸
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'
  }

  /**
   * 把 WebGL viewport 同步到 canvas 的绘图缓冲区 (drawing buffer) 尺寸
   *
   * 👉 职责：
   * - gl.viewport(0, 0, canvas.width, canvas.height)
   *   一次性把 NDC → 屏幕空间 (screen space) 的映射矩形铺满整个 framebuffer
   *
   * ❗ 调用约束：
   * - 后续渲染流程中若 RenderPass 切到自己的 FBO 并改了 viewport，
   *   需自行在结束时恢复；或由外层在每帧末尾再次调用本函数
   *   把 viewport 还原到默认 framebuffer 的全尺寸
   *
   * @param canvas 已被 setupCanvas 处理过 .width / .height 的目标画布
   * @param gl     当前 GL 上下文
   */
  private static setupGLViewport(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    // ✅ 设置 WebGL 视口（只在这里设置一次，后续无需在 draw 方法中设置）
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  /**
   * 更新主相机 (PerspectiveCamera) 的宽高比 (aspect ratio) 并重算投影矩阵 (projection matrix)
   *
   * 👉 步骤：
   * 1. camera.aspect = canvas.width / canvas.height —— 按 drawingBuffer 尺寸算 aspect
   *    （注意用 canvas.width/height 而非 CSS style 尺寸，避免 DPR 抵消后被错算）
   * 2. camera.updateProjectionMatrix() —— 用新 aspect 配合 fov / near / far
   *    重新合成投影矩阵 (projection matrix)
   *
   * 📐 公式（透视相机投影矩阵核心项受 aspect 影响）：
   *   P[0][0] = (1 / tan(fov/2)) / aspect       —— 水平 (X) 缩放
   *   P[1][1] =  1 / tan(fov/2)                 —— 垂直 (Y) 缩放
   *
   * ❗ 调用约束：
   * - 仅在 canvas 尺寸变化时调用（典型场景：window 'resize' 事件）
   * - 不修改相机的 position / target / lookAt；OrbitControls 内部状态保持不变
   *
   * @param canvas 已被 setupCanvas 处理过的目标画布（提供最新 width / height）
   * @param camera 主相机；本函数仅写其 aspect / projectionMatrix 字段
   */
  private static updateCameraAspect(canvas: HTMLCanvasElement, camera: PerspectiveCamera): void {
    camera.aspect = canvas.width / canvas.height
    camera.updateProjectionMatrix()
  }

  /**
   * 注册 window 'resize' 监听，串联 canvas / viewport / 相机的同步刷新
   *
   * 👉 流程（每次 resize 触发）：
   * 1. setupCanvas(canvas)                —— 更新 canvas.width / height (drawingBuffer + CSS)
   * 2. setupGLViewport(canvas, gl)        —— gl.viewport 同步到新尺寸
   * 3. updateCameraAspect(canvas, camera) —— 重算 aspect 并 updateProjectionMatrix
   *
   * ❗ 注意：
   * - 仅刷新尺寸 / 投影矩阵 (projection matrix)；不动相机 position / target
   * - 监听一旦注册不解绑 (unregister) —— 默认 Engine 生命周期与页面同长，
   *   故无监听器泄漏 (listener leak) 风险；如未来支持热重建 Engine，需配套移除监听
   *
   * @param canvas 受控画布
   * @param gl     当前 GL 上下文（用于刷新 viewport）
   * @param camera 主相机（用于刷新 aspect / projection matrix）
   */
  private static setupResizeHandler(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    camera: PerspectiveCamera
  ) {
    window.addEventListener('resize', () => {
      logger.debug(`window resize, canvas size: ${canvas.width} * ${canvas.height}`)
      Engine.setupCanvas(canvas) // 更新 canvas.width/height
      Engine.setupGLViewport(canvas, gl) // 更新 gl.viewport
      Engine.updateCameraAspect(canvas, camera) // 只更新 aspect
    })
  }

  /** 注册一个帧级更新器（如相机运镜）；在 mainLoop 的 update 阶段被驱动 */
  addUpdater(updater: Updatable) {
    this.updaters.push(updater)
  }

  /** 注销并释放一个帧级更新器 */
  removeUpdater(updater: Updatable): void {
    const index = this.updaters.indexOf(updater)
    if (index > -1) {
      updater.dispose?.()
      this.updaters.splice(index, 1)
    }
  }

  /**
   * 引擎级异步初始化（async initializer）：只做与「具体场景无关」的常驻准备。
   *
   * 为什么单独有这个方法：构造函数不能是 async，而坐标轴等常驻物的加载
   * 需要 await（读取 shader / 数据），故拆成「create() 同步建实例 → init() 异步补齐」两段。
   *
   * 👉 职责边界：
   * - ✅ 只加载「跨场景常驻」的内容（坐标轴 HUD 等），切换场景时不会被清理
   * - ❌ 不加载任何具体业务场景（FFT / HW1…）—— 那是 loadScene() 的职责，
   *      由调用方注入，避免 Engine 反向依赖具体场景
   *
   * @returns Promise<void>，常驻资源加载完成时 resolve；失败则 reject（由调用方 catch）
   */
  async init(): Promise<void> {
    // ==================== 加载坐标轴 ====================
    await loadAxes({
      gl: this.gl,
      renderer: this.renderer,
      camera: this.camera,
      controls: this.cameraControls
    })
  }

  /**
   * 加载一个场景（依赖注入 / dependency injection）。
   *
   * Engine 不知道、也不该知道「要加载哪个场景」——具体 loader 由调用方传入，
   * Engine 只负责：组装 SceneContext（gl / renderer / camera / controls / gui）
   * 并执行它。这样换场景只需在调用方换参数，无需改 Engine 源码。
   *
   * 👉 与 init() 的分工：
   * - init()      —— 跨场景常驻内容（一次性）
   * - loadScene() —— 可切换的业务场景；切换前一般先 renderer.clearRenderPasses()
   *
   * @param loader 符合 {@link SceneLoader} 签名的场景加载函数
   *               （如 loadFFTOceanScene / loadGames202Scenes）
   * @returns Promise<void>，场景 GPU 资源加载完成时 resolve
   *
   * @example
   * ```ts
   * await engine.init()
   * await engine.loadScene(loadFFTOceanScene) // 换场景只改这一行
   * engine.start()
   * ```
   */
  async loadScene(loader: SceneLoader): Promise<void> {
    const ctx: SceneContext = {
      gl: this.gl,
      renderer: this.renderer,
      camera: this.camera,
      controls: this.cameraControls
    }
    await loader(ctx)
  }

  /**
   * 主循环 (render loop)：每帧驱动「帧时钟 → update 阶段 → render 阶段 → 性能采样」
   *
   * 👉 每帧步骤：
   * 1. frameClock.tick()        —— 在帧边界产出本帧 FrameContext（时间 / 帧序号 / 分辨率），
   *                                update 与 render 两阶段共享同一份
   * 2. updaters 循环            —— update 阶段：各 Updatable 写场景状态（相机运镜等），
   *                                只写数据、不调 controls.update()
   * 3. cameraControls.update()  —— controls 同步的唯一收口：无 updater 时响应鼠标 /
   *                                阻尼，有 updater 时同步其写入的 camera.position
   * 4. renderer.render(frameContext) —— render 阶段：跑所有 RenderPass，透传本帧上下文
   * 5. perfMonitor.update()     —— 采样 FPS / GPU 时间
   * 6. requestAnimationFrame(...) —— 浏览器下一次刷新时回调，帧率绑定刷新率
   *
   * ❗ 启动 / 停止：
   * - 由外部仅调用一次启动；之后 rAF 自我递归驱动
   * - 不暴露显式停止开关；停止依赖 (a) 页面关闭 / (b) WebGL context lost 抛错被外层捕获
   */
  private loop(): void {
    // ----- 创建 FrameContext -----
    const frameContext = this.frameClock.tick()

    // ----- update 阶段：在 render 之前推进所有场景级动画 -----
    // 约定（contract）：updater 只「写状态数据」(camera.position / controls.target)，不「触发同步行为」(controls.update())。
    // 同步行为统一由下面那一句收口，避免有 animator 时每帧 update 两次（autoRotate 会变两倍速）。
    for (const updater of this.updaters) {
      updater.update({
        frameContext,
        camera: this.camera,
        controls: this.cameraControls
      })
    }

    // 唯一的 controls.update() 收口点：
    // - 无 updater 时：响应鼠标 / 阻尼惯性（damping）
    // - 有 updater 时：把 updater 写入的 camera.position / target 同步进 OrbitControls 内部状态
    this.cameraControls.update()

    // ----- render -----
    this.renderer.render(frameContext)

    // ----- 性能监测 -----
    this.perfMonitor.update()
    requestAnimationFrame(() => this.loop())
  }

  start(): void {
    this.loop()
  }
}
