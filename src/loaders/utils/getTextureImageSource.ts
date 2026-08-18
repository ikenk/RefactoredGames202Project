import type { Texture } from 'three'

import type { TextureImageSource } from '@/textures/types/texture'

export function getTextureImageSource(texture: Texture | null): TextureImageSource | null {
  const image: unknown = texture?.image

  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return image
  }

  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
    return image
  }

  return null
}
