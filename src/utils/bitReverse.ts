// 检查 value 的第 bitIndex 位是否为 1（value 的最低位为第 0 位）
function isBitSet(value: number, bitIndex: number): boolean {
  return (value & (1 << bitIndex)) > 0
}

// 将 value 的第 bitIndex 位设置为 1（value 的最低位为第 0 位）
function setBit(value: number, bitIndex: number): number {
  return value | (1 << bitIndex)
}

// 位反转函数
export function bitReverse(value: number, bitCount: number): number {
  // 如果 value 为 0，则无需翻转，直接返回
  if (value === 0) return 0
  let result = value
  for (let i = 0; i < bitCount; i++) {
    // 如果 value 的第 i 位为 1，那么就将其与第  位进行翻转
    // 如果 value 的第 i 位为 0 则可不用进行翻转（节省运算次数）
    if (isBitSet(result, i)) {
      // bitCount - 1 为最高位索引，减 i 表示从最高索引开始的偏移
      result = setBit(result, bitCount - 1 - i)
    }
  }
  return result
}
