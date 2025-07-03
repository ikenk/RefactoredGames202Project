import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import { ViteConfigEnv } from './env'

// console.log(new URL('./src', import.meta.url))
// console.log(import.meta.url)

// 构建配置
const buildConfigMap: Record<ViteConfigEnv, object> = {
  development: {
    build: {
      sourcemap: 'inline',
      minify: false,
      reportCompressedSize: false
    }
  },
  staging: {
    build: {
      sourcemap: true,
      minify: 'esbuild',
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000
    }
  },
  production: {
    build: {
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
      reportCompressedSize: false,
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['axios', 'lodash-es'],
            utils: ['./src/utils/index.ts']
          }
        }
      }
    }
  }
}

export default defineConfig(({ command, mode }) => {
  // console.log(`Command: ${command}, Mode: ${mode}`)
  // console.log(fileURLToPath(new URL('./', import.meta.url)))
  console.log(loadEnv(mode, fileURLToPath(new URL('./', import.meta.url))))

  const env = loadEnv(mode, fileURLToPath(new URL('./', import.meta.url)))

  // 基础配置
  const baseConfig = {
    root: fileURLToPath(new URL('./', import.meta.url)),
    base: '/',
    plugins: [],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
      extensions: ['.mjs', '.js', '.ts', '.d.ts', '.json']
    },

    // css: {
    //   preprocessorOptions: {
    //     scss: {
    //       additionalData: `@import "@/styles/variables.scss";`

    //     }
    //   },
    //   modules: {
    //     localsConvention: 'camelCase'
    //   }
    // }

    // 定义全局常量
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    },
    // 优化依赖
    optimizeDeps: {
      include: [],
      exclude: []
    }
  }

  // 开发服务器配置
  if (command == 'serve') {
    return {
      ...baseConfig,
      server: {
        port: env.VITE_PORT || 8080,
        host: true,
        open: false,
        cors: true
      }
    }
  }

  return {
    ...baseConfig,
    ...(buildConfigMap[mode] || buildConfigMap.production)
  }
})
