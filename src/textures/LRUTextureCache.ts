import { logger } from '@/logging/Logger'
import { Texture } from './Texture'

export class LRUTextureCache {
  private gl: WebGLRenderingContext
  // 在 JavaScript 中，Map 天然保持插入顺序，利用这个特性可以实现 O(1) 的 LRU
  private cache: Map<string, Texture> = new Map()
  private maxSize: number

  constructor(gl: WebGLRenderingContext, maxSize: number = 20) {
    this.gl = gl
    this.maxSize = maxSize
  }

  get(key: string): Texture | undefined {
    const texture = this.cache.get(key)
    if (!texture) return undefined

    // 关键：删除再重新插入 → 移到 Map 的"末尾"（最近使用）
    this.cache.delete(key)
    this.cache.set(key, texture)
    return texture
  }

  set(key: string, texture: Texture) {
    // 如果已存在，先删除（后面重新插入到末尾）
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // 如果满了，淘汰最久未使用的（Map 的第一个元素）
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      const oldestTexture = this.cache.get(oldestKey!)!
      oldestTexture.dispose() // 释放 GPU 资源
      this.cache.delete(oldestKey!)
      logger.debug(`[LRU] 淘汰纹理: ${oldestKey}`)
    }

    this.cache.set(key, texture)
  }

  clear(): void {
    this.cache.forEach((texture) => texture.dispose())
    this.cache.clear()
  }
}
