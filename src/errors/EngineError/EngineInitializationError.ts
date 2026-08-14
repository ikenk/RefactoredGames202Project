import { EngineError } from './BaseError'

/**
 * 引擎初始化错误
 */
export class EngineInitializationError extends EngineError {
  public readonly stage: string

  constructor(stage: string, cause?: Error) {
    super(`Engine initialization failed at stage: ${stage}`, 'ENGINE_INIT_FAILED', {
      context: {
        stage
      },
      recoverable: false,
      cause
    })

    this.stage = stage
  }

  override toUserMessage(): string {
    const stageNames: Record<string, string> = {
      webgl: 'WebGL初始化',
      camera: '相机初始化',
      renderer: '渲染器初始化',
      resources: '资源加载'
    }

    const stageName = stageNames[this.stage] ?? this.stage
    return `引擎初始化失败（${stageName}）`
  }
}
