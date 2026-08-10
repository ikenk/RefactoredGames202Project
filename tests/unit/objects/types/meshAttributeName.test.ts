import { describe, expect, it } from 'vitest'
import type { VertexAttributeName } from '@/objects/types/Mesh'

const VALID_ATTRIBUTE_NAMES = [
  'aVertexPosition',
  'aNormalPosition',
  'aTextureCoord',
  'aTangent',
  'aColor',
  'aTransportSH0',
  'aTransportSH1',
  'aTransportSH2',
  'aTransportSH3'
] as const satisfies readonly VertexAttributeName[]

// 任意名称以及不受支持的 SH slot 必须继续被拒绝。
// @ts-expect-error aTransportSH4 不在受支持的封闭联合类型中
const INVALID_ATTRIBUTE_NAME: VertexAttributeName = 'aTransportSH4'

describe('VertexAttributeName', () => {
  it('包含内置 attribute 和当前支持的 PRT transport attribute', () => {
    expect(VALID_ATTRIBUTE_NAMES).toContain('aVertexPosition')
    expect(VALID_ATTRIBUTE_NAMES).toContain('aTransportSH3')
    expect(INVALID_ATTRIBUTE_NAME).toBe('aTransportSH4')
  })
})
