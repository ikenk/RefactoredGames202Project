import { WebGLError } from './BaseError'

/**
 * WebGL 扩展不支持错误
 */
export class WebGLExtensionError extends WebGLError {
  public readonly extensionName: string

  constructor(extensionName: string, message?: string) {
    super(
      message ?? `WebGL extension "${extensionName}" is not supported`,
      'WEBGL_EXTENSION_NOT_SUPPORTED',
      {
        context: { extensionName },
        recoverable: false
      }
    )
    this.extensionName = extensionName
  }

  override toUserMessage(): string {
    const friendlyNames: Record<string, string> = {
      OES_element_index_uint: '大型网格渲染',
      OES_texture_float: '浮点纹理',
      OES_texture_half_float: '半精度浮点纹理',
      WEBGL_draw_buffers: '多重渲染目标'
    }

    const friendly = friendlyNames[this.extensionName] ?? this.extensionName

    return `您的显卡不支持 ${friendly} 功能，无法运行此程序。`
  }
}
