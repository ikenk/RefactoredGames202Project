export default {
  root: true, // 以当前目录为根
  env: {
    browser: true, // 浏览器环境，有 window、document
    node: true, // 有 require、process
    es6: true // 支持 ES6
  },
  parser: '@typescript-eslint/parser', // 用 ts 的 parser 解析 .ts
  parserOptions: {
    ecmaVersion: 6, // ES2015
    sourceType: 'module' // 使用 ES 模块
  },
  plugins: [
    '@typescript-eslint' // 加载 ts 插件
  ],
  extends: [
    'eslint:recommended', // ESLint 官方推荐规则
    'plugin:@typescript-eslint/recommended' // TS 推荐规则
  ],
  rules: {
    // 一些常用规则
    'no-console': 'warn', // console 警告提示
    semi: ['error', 'always'], // 强制用分号
    quotes: ['error', 'single'], // 强制用单引号
    '@typescript-eslint/no-unused-vars': ['warn'], // 未使用变量只警告
    '@typescript-eslint/explicit-function-return-type': 'off' // 不强制写函数返回值
  },
  // 忽略的文件
  ignorePatterns: ['node_modules', 'dist', '*.min.js', 'coverage']
}
