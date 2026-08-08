import { BaseRenderer } from '../BaseRenderer'

/**
 * HUD（抬头显示）条目：一个覆盖层小视口里要画的东西。
 *
 * 原先定义在 WebGLRenderer-deprecated.d.ts 里，但该文件被 .gitignore 的
 * `src/**\/*deprecated*` 规则排除、从未入库，导致全新克隆的仓库 type-check 必然失败。
 * 此处把仍在使用的 HUDEntry 抽出来单独存放，切断对未跟踪文件的依赖。
 */
export interface HUDEntry {
  renderer: BaseRenderer
  /** 视口左下角位置，单位为像素（相对 canvas） */
  position: { x: number; y: number }
  /** 视口边长，单位为像素（正方形） */
  size: number
}
