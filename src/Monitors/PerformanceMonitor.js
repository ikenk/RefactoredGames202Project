// 性能监控工具
export class PerformanceMonitor {
  constructor() {
    this.frameCount = 0
    this.lastTime = performance.now()
    this.fps = 0
    this.frameTimeHistory = []
    this.maxHistoryLength = 60 // 保留60帧的历史数据

    // GPU内存使用监控（如果支持）
    this.glExtension = null
    this.memoryInfo = null

    this.initGPUMonitoring()
    this.createUI()
  }

  initGPUMonitoring() {
    // 尝试获取WebGL内存信息扩展
    const canvas = document.getElementById('glcanvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

    if (gl) {
      // 检查内存信息扩展
      this.glExtension = gl.getExtension('WEBGL_debug_renderer_info')

      // 尝试获取内存使用信息
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        console.log('GPU:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
        console.log('Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
      }
    }
  }

  createUI() {
    // 创建性能显示UI
    const perfDiv = document.createElement('div')
    perfDiv.id = 'performance-monitor'
    perfDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            border-radius: 5px;
        `
    document.body.appendChild(perfDiv)
    this.perfDiv = perfDiv
  }

  update() {
    const currentTime = performance.now()
    const deltaTime = currentTime - this.lastTime

    this.frameCount++
    this.frameTimeHistory.push(deltaTime)

    // 保持历史数据长度
    if (this.frameTimeHistory.length > this.maxHistoryLength) {
      this.frameTimeHistory.shift()
    }

    // 每60帧更新一次显示
    if (this.frameCount % 60 === 0) {
      this.updateDisplay()
    }

    this.lastTime = currentTime
  }

  updateDisplay() {
    // 计算平均帧率
    const avgFrameTime =
      this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length
    this.fps = 1000 / avgFrameTime

    // 计算最小和最大帧时间
    const minFrameTime = Math.min(...this.frameTimeHistory)
    const maxFrameTime = Math.max(...this.frameTimeHistory)

    // 检查内存使用
    const memoryInfo = this.getMemoryInfo()

    // 更新显示
    this.perfDiv.innerHTML = `
            <div><strong>性能监控</strong></div>
            <div>FPS: ${this.fps.toFixed(1)}</div>
            <div>平均帧时间: ${avgFrameTime.toFixed(2)}ms</div>
            <div>最小帧时间: ${minFrameTime.toFixed(2)}ms</div>
            <div>最大帧时间: ${maxFrameTime.toFixed(2)}ms</div>
            ${memoryInfo}
            <div>总帧数: ${this.frameCount}</div>
        `

    // 如果帧率太低，显示警告
    if (this.fps < 15) {
      this.perfDiv.style.borderLeft = '5px solid red'
    } else if (this.fps < 30) {
      this.perfDiv.style.borderLeft = '5px solid yellow'
    } else {
      this.perfDiv.style.borderLeft = '5px solid green'
    }
  }

  getMemoryInfo() {
    let memoryInfo = ''

    // 尝试获取JavaScript内存信息
    if (performance.memory) {
      const used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)
      const total = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1)
      const limit = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1)

      memoryInfo += `
                <div>JS内存: ${used}/${total}MB (限制:${limit}MB)</div>
            `
    }

    return memoryInfo
  }

  // 记录特定操作的性能
  measureOperation(name, operation) {
    const startTime = performance.now()
    const result = operation()
    const endTime = performance.now()

    console.log(`${name}: ${(endTime - startTime).toFixed(2)}ms`)
    return result
  }

  // GPU绘制调用计数器
  trackDrawCalls(gl) {
    let drawCallCount = 0

    // 包装drawElements和drawArrays方法
    const originalDrawElements = gl.drawElements.bind(gl)
    const originalDrawArrays = gl.drawArrays.bind(gl)

    gl.drawElements = function (...args) {
      drawCallCount++
      return originalDrawElements(...args)
    }

    gl.drawArrays = function (...args) {
      drawCallCount++
      return originalDrawArrays(...args)
    }

    // 定期重置计数器并显示
    setInterval(() => {
      console.log(`Draw Calls per second: ${drawCallCount}`)
      drawCallCount = 0
    }, 1000)
  }
}
