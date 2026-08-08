import { loadHW1Scene } from '@/scenes/games202/hw1/loadHW1Scene'
import { loadHW2Scene } from '@/scenes/games202/hw2/loadHW2Scene'
import { loadHW4Scene } from '@/scenes/games202/hw4/loadHW4Scene'
import { loadHW3Scene } from '@/scenes/games202/hw3/cave/loadHW3Scene'
import { SceneContext } from '@/scenes/types/SceneContext'
import { SceneDisposer } from '@/scenes/types/SceneDisposer'
import { GUI } from 'dat.gui'
import { mountDatGUI } from '../_shared/mountGUI'

/**
 * 注册 dat.GUI 下拉菜单 (dropdown)，运行时切换 Games202 作业场景 HW1..HW4
 *
 * 👉 流程：
 * 1. 准备场景名列表 ['HW1', 'HW2', 'HW3', 'HW4'] 与默认值 state.scene = 'HW1'
 * 2. await this.switchScene(state.scene) —— 启动时同步加载默认场景
 * 3. gui.add(state, 'scene', sceneNames).onChange(...) —— 用户切换时异步加载新场景
 *
 * 各作业内容：
 *   HW1 —— Shadow (PCSS)                                 —— Mary & Floor
 *   HW2 —— PRT (Precomputed Radiance Transfer)           —— Mary & Cubemap
 *   HW3 —— SSR (Screen Space Reflection)                 —— cave & cube
 *   HW4 —— Kulla-Conty 多次散射补偿 (multi-scatter comp.) —— ball
 *
 * ❗ 注意：
 * - onChange 回调里 switchScene 是 async；这里用 .catch 拦截，避免
 *   unhandled Promise rejection 在控制台冒泡为红色 stack
 * - 当前 init() 中未调用本方法（被注释），需要切回作业 demo 时
 *   取消 init() 里对应注释即可
 */
export async function setupGames202HWSceneGUI(ctx: SceneContext) {
  const sceneNames = ['HW1', 'HW2', 'HW3', 'HW4']
  const state = { scene: 'HW1' }

  /** 当前活跃场景的清理函数 */
  let activeSceneDisposer: SceneDisposer | null = null

  const gui = mountDatGUI()
  const name = 'switch scenes'
  const folder = gui.addFolder(name)

  /**
   * 卸载当前场景 → 清空渲染通道 (render pass) → 加载新场景
   * （定义在内部，闭包捕获 activeSceneDisposer，重新赋值对外可见）
   *
   * 👉 步骤：
   * 1. 调用 activeSceneDisposer()（若存在）—— 释放上一场景持有的 GPU 资源
   *    (FBO / Texture / Shader / ManagerRegistry 注册项等)，并把字段置回 null
   * 2. renderer.clearRenderPasses() —— 清空 RenderPass 列表
   *    (overlayRenderPass 例外，由 WebGLRenderer 自身常驻持有，不在清理范围)
   * 3. 构造 SceneContext { gl, renderer, camera, controls, gui } 注入到 loader
   * 4. 按 name 分发到对应 loadHWxScene(ctx)，loader 返回新的 disposer
   *    并存到 this.activeSceneDisposer，供下次切换时调用
   *
   * ❗ 一致性：
   * - 严格保持「先 dispose 再 load」顺序，否则 GUI 控件 / pass 顺序会与 GPU 资源错位
   * - 未匹配 name 时静默无操作（场景保持不变），作为非法值的兜底 (fallback)
   *
   * @param name 场景标识：'HW1' | 'HW2' | 'HW3' | 'HW4'
   * @returns    Promise<void>，新场景 GPU 资源加载完成时 resolve
   */
  async function switchScene(name: string): Promise<void> {
    // 1. 清理旧场景
    if (activeSceneDisposer) {
      activeSceneDisposer()
      //       console.log('activeSceneDisposer: ', activeSceneDisposer)
      activeSceneDisposer = null
    }
    // 2. 清空 renderer 的所有 pass（除了 WebGLRenderer 中的 overlayRenderPass)
    ctx.renderer.clearRenderPasses()

    // 3. 加载新场景
    switch (name) {
      case 'HW1':
        // HW1 Shadow -- Mary & Floor
        activeSceneDisposer = await loadHW1Scene(ctx)
        break
      case 'HW2':
        // HW2 PRT -- Mary & Cubumap
        activeSceneDisposer = await loadHW2Scene(ctx)
        break
      case 'HW3':
        // HW3 SSR -- cave & cube
        activeSceneDisposer = await loadHW3Scene(ctx)
        break
      case 'HW4':
        // HW4 Kulla-Conty -- ball
        activeSceneDisposer = await loadHW4Scene(ctx)
        break
    }
  }

  await switchScene(state.scene)

  folder.add(state, 'scene', sceneNames).onChange((name: string) => {
    switchScene(name).catch(() =>
      console.error('[Engine setupSceneGUI] Function switchScene failed.')
    )
  })
  folder.open()
}
