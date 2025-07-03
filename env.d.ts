/// <reference types="vite/client" />

declare global {
  const __BUILD_TIME__: string
  const __APP_VERSION__: string
}

interface ImportMetaEnv {
  readonly VITE_PORT: number
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export type ViteConfigEnv = 'development' | 'staging' | 'production'

// 确保 global 声明生效
export {}
