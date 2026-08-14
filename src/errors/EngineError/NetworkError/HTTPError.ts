import { NetworkError } from './BaseError'

/**
 * HTTP状态错误
 */
export class HttpError extends NetworkError {
  public readonly statusText: string
  constructor(url: string, status: number, statusText: string) {
    super(url, `HTTP ${status} ${statusText}: ${url}`, {
      httpStatus: status
    })

    this.statusText = statusText
  }

  override toUserMessage(): string {
    const messages: Record<number, string> = {
      400: '请求参数错误',
      401: '未授权访问',
      403: '访问被拒绝',
      404: '资源不存在',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务不可用'
    }

    return messages[this.httpStatus!] ?? `网络错误 (${this.httpStatus})`
  }
}
