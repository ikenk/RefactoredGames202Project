/// <reference types="vite/client" />

// 保留：作为学习记录
// declare global {
//   const __BUILD_TIME__: string
//   const __APP_VERSION__: string
//   const __APP_ROOT_PATH__: string
//   const __DEBUG__: string
// }

/**
 * 下列常量和 interface ImportMetaEnv 中的扩展属性无法在外部文件中被 ts 识别的问题
 *
 * 写了 export 的文件会被当作 module，而原先的代码中包含了 export，
 * 因此下列的常量和对 interface ImportMetaEnv 的扩展无法在全局生效，
 * 只有将它们都写在 declare global 这个全局声明中才能在外部的文件中被 ts 提示
 *
 * 现在注释掉了 export 相关代码，此处的声明和扩展恢复到了全局，所以就可以在其他的文件里使用了
 */
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string
// declare const __DEBUG__: boolean

interface ImportMetaEnv {
  // vite.config.ts 在 Node.js 环境中通过 loadEnv() 使用到的 VITE_PORT 和 VITE_BASE_URL，因此在此处声明并不能为 env.VITE_PORT 提供类型，反而会让浏览器端代码误以为应该通过 import.meta.env.VITE_PORT 使用它。
  // readonly VITE_PORT: string
  // readonly VITE_BASE_URL: string
  readonly VITE_SHADER_BASE: string
  readonly VITE_TEXTURE_BASE: string
  readonly VITE_MODEL_BASE: string
  readonly VITE_PRT_SH_BASE: string
}

// export {}
