import '@/styles/main.css'
import '@/styles/gui-stack.css'
import '@/styles/tweakpane-theme.css'
import '@/styles/datgui-theme.css'
import { Engine } from './engine'
import { WebGLNotSupportedError } from './errors/EngineError/WebGLError/WebGLNotSupportedError'
import { WebGLExtensionError } from './errors/EngineError/WebGLError/WebGLExtensionError'
import { ResourceLoadError } from './errors/EngineError/ResourceError/ResourceLoadError'
import { EngineError } from './errors/EngineError/BaseError'
import { ConfigNotFoundError } from './errors/EngineError/ConfigurationError/ConfigNotFoundError'
import { ConfigParseError } from './errors/EngineError/ConfigurationError/ConfigParseError'
import { NetworkTimeoutError } from './errors/EngineError/NetworkError/NetworkTimeoutError'
import { NetworkOfflineError } from './errors/EngineError/NetworkError/NetworkOfflineError'
import { HttpError } from './errors/EngineError/NetworkError/HTTPError'
import { EngineInitializationError } from './errors/EngineError/EngineInitializationError'

import { loadGames202Scenes } from './scenes/games202/loadGames202Scene'

let titleEle = document.querySelector('head title')
if (!titleEle) {
  titleEle = document.createElement('title')
  titleEle.textContent = `GAMES202 Homework ${__BUILD_TIME__}`
  document.head.appendChild(titleEle)
} else {
  titleEle.textContent = `GAMES202 Homework ${__BUILD_TIME__}`
}

const canvas = document.querySelector<HTMLCanvasElement>('#glcanvas')
// 如果 canvas 不存在就抛出错误
if (!canvas) {
  alert('Cannot find canvas element with id #glcanvas\n找不到Canvas元素，请试试别的浏览器吧')
  throw new EngineInitializationError('Cannot find canvas element with id #glcanvas')
}

// ==================== method 1st ====================
// async function bootstrap(canvas:HTMLCanvasElement) {
// const engine = Engine.create(canvas)
//   await engine.init()
//   await engine.loadScene(loadFFTOceanScene)
//   engine.start() // 同步方法，不用 await
// }
// bootstrap(canvas).catch((error) => console.error('引擎启动失败:', error))

// ==================== method 2nd ====================
const engine = Engine.create(canvas)
engine
  .init()
  .then(async () => {
    // ----- Games202 Homework 场景切换 (HW1..HW4，由 dat.GUI 下拉菜单驱动) -----
    return engine.loadScene(loadGames202Scenes)
  })
  .then(() => {
    engine.start()
  })
  .catch((error) => {
    console.error('引擎启动失败:', error)
  })

// ==================== method 3rd ====================
// void (async () => {
//   try {
//     await engine.init()
//     engine.mainLoop()
//   } catch (error) {
//     console.error('引擎启动失败:', error)
//   }
// })()

// ==================== handle errors ====================

function handleError(error: unknown) {
  console.error(error)

  if (error instanceof WebGLNotSupportedError) {
    // WebGL不支持
    showErrorDialog({
      title: 'WebGL 不支持',
      message: error.toUserMessage(),
      actions: [{ label: '查看浏览器支持', href: 'https://get.webgl.org/' }]
    })
  } else if (error instanceof WebGLExtensionError) {
    // 扩展不支持
    showErrorDialog({
      title: '硬件不支持',
      message: error.toUserMessage(),
      detail: `缺少扩展：${error.extensionName}`,
      actions: [{ label: '更新显卡驱动', href: 'https://www.nvidia.com/drivers' }]
    })
  } else if (error instanceof ResourceLoadError) {
    // 资源加载失败
    showErrorDialog({
      title: '资源加载失败',
      message: error.toUserMessage(),
      detail: error.context?.httpStatus ? `HTTP ${error.context.httpStatus}` : undefined,
      actions: [{ label: '重试', onClick: () => window.location.reload() }]
    })
  } else if (error instanceof EngineError) {
    // 其他引擎错误
    showErrorDialog({
      title: '引擎错误',
      message: error.toUserMessage(),
      detail: `错误码：${error.code}`,
      actions: [{ label: '反馈问题', href: 'https://github.com/your-repo/issues' }]
    })
  } else {
    // 未知错误
    showErrorDialog({
      title: '未知错误',
      message: '程序遇到未知错误，请刷新页面重试。',
      detail: error instanceof Error ? error.message : String(error)
    })
  }

  // 上报错误到监控系统
  if (error instanceof EngineError) {
    reportError(error.toJSON())
  }
}

function showErrorDialog(config: {
  title: string
  message: string
  detail?: string
  actions?: Array<{
    label: string
    onClick?: () => void
    href?: string
  }>
}) {
  // 创建错误对话框UI
  const dialog = document.createElement('div')
  dialog.className = 'error-dialog'
  dialog.innerHTML = `
    <div class="error-dialog-content">
      <h2>${config.title}</h2>
      <p>${config.message}</p>
      ${config.detail ? `<details><summary>详细信息</summary>${config.detail}</details>` : ''}
      <div class="error-actions">
        ${
          config.actions
            ?.map((action) =>
              action.href
                ? `<a href="${action.href}" target="_blank">${action.label}</a>`
                : `<button onclick="${action.onClick}">${action.label}</button>`
            )
            .join('') || ''
        }
      </div>
    </div>
  `
}

function reportError(errorData: any) {
  // 发送到监控服务（Sentry、LogRocket等）
  //   console.log('Report error:', errorData)
}

function loadDefaultConfig() {}

function handleConfigError(error: unknown) {
  if (error instanceof ConfigNotFoundError) {
    showErrorDialog({
      title: '配置文件不存在',
      message: error.toUserMessage(),
      detail: `请确保 ${error.configPath} 文件存在`,
      actions: [
        { label: '使用默认配置', onClick: () => loadDefaultConfig() },
        { label: '刷新页面', onClick: () => location.reload() }
      ]
    })
  } else if (error instanceof ConfigParseError) {
    showErrorDialog({
      title: '配置文件格式错误',
      message: error.toUserMessage(),
      detail: error.cause?.message,
      actions: [
        { label: '查看文档', href: '/docs/config.html' },
        { label: '反馈问题', href: 'https://github.com/...' }
      ]
    })
  } else if (error instanceof NetworkTimeoutError) {
    showErrorDialog({
      title: '网络超时',
      message: error.toUserMessage(),
      actions: [{ label: '重试', onClick: () => location.reload() }]
    })
  } else if (error instanceof NetworkOfflineError) {
    showErrorDialog({
      title: '网络离线',
      message: error.toUserMessage(),
      actions: [{ label: '刷新页面', onClick: () => location.reload() }]
    })
  } else if (error instanceof HttpError) {
    showErrorDialog({
      title: 'HTTP错误',
      message: error.toUserMessage(),
      detail: `URL: ${error.url}\nStatus: ${error.httpStatus}`
    })
  }
}
