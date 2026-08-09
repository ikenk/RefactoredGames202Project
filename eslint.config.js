import js from '@eslint/js'
import html from '@html-eslint/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import markdown from 'eslint-plugin-markdown'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const javascriptAndTypeScriptFiles = ['**/*.{js,mjs,cjs,ts,mts,cts}']

const typeScriptFiles = ['**/*.{ts,mts,cts}']

const isProductionLint = process.env.LINT_MODE === 'production'

/**
 * typescript-eslint 的推荐配置没有统一限定 files。
 *
 * 这里将每一项都限制到 TypeScript 文件，避免这些配置错误地作用于
 * HTML、Markdown 等非 TypeScript 文件。
 */
const typeScriptRecommendedConfigs = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: typeScriptFiles
}))

export default [
  // ============================================================
  // 全局忽略
  // ============================================================

  {
    name: 'project/ignores',

    ignores: [
      '.claude/**',
      'codex-*/**',
      'claude-*/**',

      '**/node_modules/**',
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/.vite/**',

      // 静态资源不属于 ESLint 检查范围
      'public/**',

      // C++ 作业及其生成目录不属于当前 TypeScript 工程
      'prt/**',
      'lut-gen/**',

      // 历史参考文件
      'reference/**',

      // 当前不进入正式检查链路的调试、废弃实现
      'src/debug/**',
      'src/**/deprecated/**',
      'src/**/*-deprecated.ts',
      'src/**/*-deprecated.d.ts',
      'src/**/*Deprecated*/**',

      '**/*.min.js'
    ]
  },

  // ============================================================
  // JavaScript / TypeScript 推荐规则
  // ============================================================

  {
    ...js.configs.recommended,

    name: 'project/javascript-recommended',
    files: javascriptAndTypeScriptFiles
  },

  ...typeScriptRecommendedConfigs,

  // ============================================================
  // JS / TS 通用代码质量规则
  // ============================================================

  {
    name: 'project/code',

    files: javascriptAndTypeScriptFiles,

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      globals: {
        ...globals.es2022
      }
    },

    plugins: {
      import: importPlugin
    },

    rules: {
      'no-console': 'off',
      'prefer-const': 'warn',

      /**
       * Prettier 不会替你修改注释内容，
       * 因此 spaced-comment 仍然属于 ESLint 职责。
       */
      'spaced-comment': [
        'error',
        'always',
        {
          line: {
            markers: ['/'],
            exceptions: ['-', '+', '=']
          },
          block: {
            markers: ['!'],
            exceptions: ['*'],
            balanced: true
          }
        }
      ],

      /**
       * 禁止导出可重新赋值的 let 绑定。
       */
      'import/no-mutable-exports': 'error'
    }
  },

  // ============================================================
  // TypeScript 通用规则
  // ============================================================

  {
    name: 'project/typescript',

    files: typeScriptFiles,

    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],

      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'interface',
          format: ['PascalCase']
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase']
        }
      ],

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/deprecated/**', '**/*-deprecated', '**/*-Deprecated/**'],
              message:
                'deprecated 代码被 .gitignore 排除、从不入库。活代码 import 它 = 本地能跑、全新克隆必挂。' +
                '需要的话把用到的部分抽到正式路径下。'
            }
          ]
        }
      ]
    }
  },

  // ============================================================
  // 正式源码：浏览器环境 + 类型感知规则
  // ============================================================

  {
    name: 'project/source',

    files: ['src/**/*.ts'],

    ignores: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',

      // Markdown processor 产生的虚拟 TS 文件不能加入正式 tsconfig
      '**/*.md/*.ts'
    ],

    languageOptions: {
      globals: {
        ...globals.browser
      },

      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },

    rules: {
      // Promise
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/promise-function-async': 'warn',

      // 类型安全
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'error',

      // 可读性
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',

      /**
       * 对当前渲染代码过于严格，暂时关闭。
       */
      '@typescript-eslint/strict-boolean-expressions': 'off'
    }
  },

  {
    name: 'project/production-console-policy',

    files: ['src/**/*.ts'],

    rules: {
      /**
       * 开发检查：所有 console 都允许。
       *
       * 生产检查：
       * - console.warn / console.error 允许；
       * - console.log / debug / info 报错。
       */
      'no-console': isProductionLint
        ? [
            'error',
            {
              allow: ['warn', 'error']
            }
          ]
        : 'off'
    }
  },

  {
    name: 'project/production-console-relaxed-modules',

    files: [
      'src/loaders/**/*.ts',
      'src/textures/**/loaders/**/*.ts',
      'src/monitors/**/*.ts',
      'src/simulation/**/analysis/**/*.ts'
    ],

    rules: {
      /**
       * 资源加载进度、GPU 信息、FFT 分析结果属于这些模块的职责。
       */
      'no-console': 'off'
    }
  },

  // ============================================================
  // 所有测试
  // ============================================================

  {
    name: 'project/tests',

    files: ['tests/**/*.ts'],

    languageOptions: {
      globals: {
        ...globals.vitest
      },

      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname
      }
    },

    rules: {
      /**
       * 测试中有时需要构造不完整对象、错误输入和 mock，
       * 因此适当放宽 unsafe/any 规则。
       */
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',

      /**
       * Vitest 的 expect 调用和测试回调不按照业务 Promise
       * 的方式检查。
       */
      '@typescript-eslint/no-floating-promises': 'off'
    }
  },

  // Node 单元测试、集成测试
  {
    name: 'project/node-tests',

    files: ['tests/unit/**/*.ts', 'tests/integration/**/*.ts'],

    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },

  // Chromium 浏览器测试、E2E
  {
    name: 'project/browser-tests',

    files: ['tests/browser/**/*.ts', 'tests/e2e/**/*.ts'],

    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },

  // ============================================================
  // Node 配置文件
  // ============================================================

  {
    name: 'project/typescript-config-files',

    files: ['vite.config.ts', 'vitest.config.ts'],

    languageOptions: {
      globals: {
        ...globals.node
      },

      parserOptions: {
        project: './tsconfig.node.json',
        tsconfigRootDir: import.meta.dirname
      }
    },

    rules: {
      'no-console': 'off'
    }
  },

  {
    name: 'project/javascript-config-files',

    files: ['*.config.js'],

    languageOptions: {
      globals: {
        ...globals.node
      }
    },

    rules: {
      'no-console': 'off'
    }
  },

  {
    name: 'project/node-scripts',

    files: ['scripts/**/*.{js,mjs,cjs}'],

    languageOptions: {
      globals: {
        ...globals.node
      }
    },

    rules: {
      'no-console': 'off'
    }
  },

  // ============================================================
  // Markdown 代码块
  // ============================================================

  {
    name: 'project/markdown',

    files: ['**/*.md'],
    processor: markdown.processors.markdown
  },

  {
    name: 'project/markdown-code-blocks',

    files: ['**/*.md/*.{js,ts}'],

    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',

      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',

      /**
       * 文档示例可能故意引用尚未安装或仅用于说明的模块。
       */
      'import/no-unresolved': 'off'
    }
  },

  // ============================================================
  // HTML
  // ============================================================

  {
    name: 'project/html',

    files: ['**/*.html', '**/*.htm'],

    plugins: {
      html
    },

    language: 'html/html',

    rules: {
      'html/no-duplicate-class': 'error'
    }
  },

  // ============================================================
  // 必须放在最后
  // ============================================================

  /**
   * 它同时完成三件事：
   *
   * 1. 注册 eslint-plugin-prettier；
   * 2. 启用 prettier/prettier；
   * 3. 使用 eslint-config-prettier 关闭冲突格式规则。
   *
   * 这里不能再在后面重新开启 semi、quotes 等 ESLint 格式规则。
   */
  eslintPluginPrettierRecommended
]
