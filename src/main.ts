import '@/styles/main.css'
import { Engine } from './engine'

document.querySelector('head title').textContent = `Refactored Games202 Project ${__BUILD_TIME__}`

const canvas = document.querySelector('#glcanvas') as HTMLCanvasElement
// 如果 canvas 不存在就抛出错误
if (!canvas) {
  alert('Cannot find canvas element with id #glcanvas\n找不到Canvas元素，请试试别的浏览器吧')
  throw new Error('Cannot find canvas element with id #glcanvas')
}
// 设置 canvas 的宽和高
canvas.width = window.screen.width
canvas.height = window.screen.height

const engine = new Engine(canvas)
