import { FileLoader } from 'three'

export function loadShaderFile(filename: string) {
  return new Promise<string | ArrayBuffer>((resolve, reject) => {
    const loader = new FileLoader()

    loader.load(filename, (data) => {
      // console.log('data', data)
      resolve(data)
    })
  })
}

// export async function getShaderString(filename) {
//   let val = ''
//   await loadShaderFile(filename).then((result) => {
//     val = result
//   })
//   return val
// }

export async function getShaderString(filename: string): Promise<string> {
  try {
    let val = (await loadShaderFile(filename)) as string
    return val
  } catch (error) {
    console.log('getShaderString function has an error: ', error)
    throw error
  }
}
