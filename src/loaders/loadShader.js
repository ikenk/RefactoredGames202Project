import { FileLoader } from 'three'

export async function loadShaderFile(filename) {
  return new Promise((resolve, reject) => {
    const loader = new FileLoader()

    loader.load(filename, (data) => {
      resolve(data)
    })
  })
}

// export async function getShaderString(filename) {
//   let val = ''
//   await this.loadShaderFile(filename).then((result) => {
//     val = result
//   })
//   return val
// }

export async function getShaderString(filename) {
  let val = ''
  await loadShaderFile(filename).then((result) => {
    val = result
  })
  return val
}
