// import * as THREE from 'three'
import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GUI } from 'dat.gui'

import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { FBO } from '@/textures/FBO'
import { loadWater } from '@/managers/water/WaterRenderManager'
import { WaterPresets } from '@/managers/water/WaterPresets'
import { loadGLTF } from '@/loaders/loadGLTF'
import { DirectionalLight } from '@/lights/DirectionalLight'

import type { LightParams } from '@/types/light'
import type { CameraType, SceneType, LightType } from '@/types/engine'
import { Vec3 } from '@/types/math'

import { PerformanceMonitor } from '@/monitors/PerformanceMonitor'

export class Engine {
  // public
  // 上下文属性
  public canvas: HTMLCanvasElement
  public gl: WebGLRenderingContext
  public gl_draw_buffers: WEBGL_draw_buffers
  // 相机相关属性
  private cameraPosition: [number, number, number] // 相机位置
  private cameraTarget: [number, number, number] // 相机观察的目标点
  public camera: PerspectiveCamera
  private cameraControls: OrbitControls
  // 渲染器
  public renderer: WebGLRenderer

  private perfMonitor: PerformanceMonitor

  constructor(canvas: HTMLCanvasElement) {
    // 上下文属性
    this.canvas = canvas
    // this.gl = new WebGLRenderingContext()
    // this.gl_draw_buffers = null

    // // 相机相关属性
    // this.cameraPosition = [0,0,0] // 相机位置
    // this.cameraTarget = [0,0,0] // 相机观察的目标点
    // this.camera = null
    // this.cameraControls = null

    // // 渲染器
    // this.renderer = null

    // 初始化渲染流程
    this.init()

    console.log('Class Engine has initialized')
  }

  init() {
    // 初始化上下文
    this.initGL()
    // 初始化相机和控制参数
    // this.initCameraParams('CubeSceneCamera')
    this.initCameraParams('CaveSceneCamera')
    this.initCamera()
    this.initCameraControls()

    // 初始化渲染器
    this.initRenderer()
    // 加载场景
    // this.loadSceneGLTF('CubeScene')
    // this.loadSceneGLTF('CaveScene')
    // 加载水场景
    // loadWater(this.renderer, WaterPresets.createCalmLake())
    loadWater(this.renderer, WaterPresets.createGerstnerWaves())
    // 加载灯光
    // this.addLight('CubeLight')
    this.addLight('CaveLight')
    // 加载调参面板
    this.initGUI()
    // 初始化性能检测器
    this.initPerformanceMonitor()
  }

  // 初始化上下文
  initGL() {
    let gl = this.canvas.getContext('webgl')
    if (!gl) {
      alert('Unable to initialize WebGL. Your browser or machine may not support it.')
      throw new Error('Unable to initialize WebGL. Your browser or machine may not support it.')
    }
    // 以下功能不需要额外库，都是 WebGL 的标准扩展（这些扩展只在 WebGL1 中需要显式启用，在 WebGL2 中都是默认可用的）
    // 启用 OES_texture_float 扩展，该扩展允许 WebGL 使用浮点数像素类型的纹理
    gl.getExtension('OES_texture_float')
    // 启用 WEBGL_draw_buffers 扩展
    this.gl_draw_buffers = gl.getExtension('WEBGL_draw_buffers')
    // 查询系统支持的最大绘制缓冲区数量
    let maxdb = gl.getParameter(this.gl_draw_buffers.MAX_DRAW_BUFFERS_WEBGL)
    console.log('MAX_DRAW_BUFFERS_WEBGL: ' + maxdb)

    this.gl = gl
  }

  // 初始化场景中的相机和控件参数
  initCameraParams(CameraType: CameraType) {
    switch (CameraType) {
      case 'CubeSceneCamera':
        this.cameraPosition = [6, 1, 0]
        this.cameraTarget = [0, 0, 0]
        break
      case 'CaveSceneCamera':
        this.cameraPosition = [4.18927, 1.0313, 2.07331]
        this.cameraTarget = [2.92191, 0.98, 1.55037]
        break
      default:
        this.cameraPosition = [6, 1, 0]
        this.cameraTarget = [0, 0, 0]
    }
  }
  // 初始化相机
  initCamera() {
    const camera = new PerspectiveCamera(
      75,
      this.canvas.clientWidth / this.canvas.clientHeight,
      1e-3,
      1000
    )

    camera.position.set(this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2])
    // let fbo = new FBO(this.gl, this.gl_draw_buffers)
    camera.fbo = new FBO(this.gl, this.gl_draw_buffers).getFrameBuffer()
    this.camera = camera

    this.resetCameraSize(this.canvas.clientWidth, this.canvas.clientHeight)
    window.addEventListener('resize', () => {
      this.resetCameraSize(this.canvas.clientWidth, this.canvas.clientHeight)
    })
  }
  // 重置相机 FOV 和投影矩阵
  resetCameraSize(width: number, height: number) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
  // 初始化相机控制对象
  initCameraControls() {
    const cameraControls = new OrbitControls(this.camera, this.canvas)
    // 启用鼠标缩放，缩放速度为 1.0 倍标准速度
    cameraControls.enableZoom = true
    cameraControls.zoomSpeed = 1.0
    // 启用鼠标旋转，旋转速度为 0.3 倍标准速度
    cameraControls.enableRotate = true
    cameraControls.rotateSpeed = 0.3
    // 启用鼠标平移，平移速度为 0.8 倍标准速度
    cameraControls.enablePan = true
    cameraControls.panSpeed = 0.8
    // cameraControls.target.set 必须在 camera.position.set 之后执行，而且参数不能为 null 或者 undefined，否则会影响 camera.position 中的值
    cameraControls.target.set(this.cameraTarget[0], this.cameraTarget[1], this.cameraTarget[2])

    this.cameraControls = cameraControls
  }

  // 加载场景
  loadSceneGLTF(sceneType: SceneType) {
    switch (sceneType) {
      case 'CubeScene':
        loadGLTF(this.renderer, 'assets/cube/', 'cube1', 'SSRMaterial')
        // loadGLTF(this.renderer, 'assets/cube/', 'cube2', 'SSRMaterial')
        break
      case 'CaveScene':
        loadGLTF(this.renderer, 'assets/cave/', 'cave', 'SSRMaterial')
        break
      default:
        return
    }
  }

  // 初始化渲染器
  initRenderer() {
    const renderer = new WebGLRenderer(this.gl, this.gl_draw_buffers, this.camera)
    this.renderer = renderer
  }

  // 添加灯光
  addLight(lightType: LightType) {
    let lightUp: Vec3 = [1, 0, 0]
    let lightParams = this.getLightParams(lightType)
    // console.log(lightParams)

    const directionLight = new DirectionalLight(
      lightParams.lightRadiance,
      lightParams.lightPos,
      lightParams.lightDir,
      lightUp,
      this.gl,
      this.gl_draw_buffers
    )
    this.renderer.addLight(directionLight)
    // console.log(this.renderer.lights)
  }
  // 返回灯光参数
  getLightParams(lightType: LightType): LightParams {
    switch (lightType) {
      case 'CubeLight':
        return {
          lightRadiance: [1, 1, 1],
          lightPos: [-2, 4, 1],
          lightDir: {
            x: 0.4,
            y: -0.9,
            z: -0.2
          }
        }
      case 'CaveLight':
        return {
          lightRadiance: [20, 20, 20],
          lightPos: [-0.45, 5.40507, 0.637043],
          lightDir: {
            x: 0.39048811,
            y: -0.89896828,
            z: 0.19843153
          }
        }
      default:
        return {
          lightRadiance: [1, 1, 1],
          lightPos: [0, 0, 0],
          lightDir: {
            x: 0,
            y: 0,
            z: 0
          }
        }
    }
  }

  // 初始化 GUI 调参面板
  initGUI() {
    const gui = new GUI()
    const lightPanel = gui.addFolder('Directional Light')

    lightPanel.add(this.renderer.lights[0].entity.lightDir, 'x', -10, 10, 0.1)
    lightPanel.add(this.renderer.lights[0].entity.lightDir, 'y', -10, 10, 0.1)
    lightPanel.add(this.renderer.lights[0].entity.lightDir, 'z', -10, 10, 0.1)
    lightPanel.open()
  }

  // 初始化性能检测器
  initPerformanceMonitor() {
    const perfMonitor = new PerformanceMonitor()
    this.perfMonitor = perfMonitor
  }

  // 启动渲染
  mainLoop() {
    this.cameraControls.update()
    this.renderer.render()
    this.perfMonitor.update()
    requestAnimationFrame(() => this.mainLoop())
    // console.log('mainLoop is running')
  }
}
