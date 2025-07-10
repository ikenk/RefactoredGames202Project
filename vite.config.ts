import { fileURLToPath, URL } from 'url'
import { defineConfig, loadEnv, UserConfig } from 'vite'
import { ViteConfigEnv } from './env'

// console.log(new URL('./src', import.meta.url))
// console.log(import.meta.url)

// 构建配置
const buildConfigMap: Record<ViteConfigEnv, UserConfig> = {
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
  console.log(`Command: ${command}, Mode: ${mode}`)
  // console.log(fileURLToPath(new URL('./', import.meta.url)))
  console.log(loadEnv(mode, fileURLToPath(new URL('./', import.meta.url))))

  const env = loadEnv(mode, fileURLToPath(new URL('./', import.meta.url)))

  // 基础配置
  const baseConfig: UserConfig = {
    // 项目根目录位置
    root: fileURLToPath(new URL('./', import.meta.url)),
    // 应用的基础公共路径，部署在 https://domain.com/
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
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __APP_ROOT_PATH__: JSON.stringify(fileURLToPath(new URL('./', import.meta.url)))
    },
    // 优化依赖
    optimizeDeps: {
      include: [],
      exclude: []
    },
    // 可以直接导入assets文件，import modelUrl from './assets/model.obj' 或者 import modelData from './assets/model.obj?raw' 或者 import modelUrl from './assets/model.obj?url'
    assetsInclude: ['**/*.obj', '**/*.mtl', '**/*.fbx', '**/*.gltf']
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
      },
      // 添加开发环境的其他配置
      css: {
        devSourcemap: true // 开发环境的 CSS sourcemap
      },
      esbuild: {
        drop: [] // 开发环境保留 console.log
      }
    }
  }

  return {
    ...baseConfig,
    ...(buildConfigMap[mode] || buildConfigMap.production)
  }
})
