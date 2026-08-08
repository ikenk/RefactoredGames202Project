# GAMES202 Homework

> GAMES202（闫令琪《现代计算机图形学入门：实时高质量渲染》）四次作业的完整实现，
> 跑在一套**从零手写的 WebGL 1.0 渲染引擎**上——不依赖 three.js 的渲染管线。

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-1.0-990000?logo=webgl&logoColor=white)

## 这是什么

本分支是 [AImimi Engine](../../tree/main) 的 **GAMES202 作业展示版**：从主线工程中剥离出运行四次作业所需的最小代码集，去掉了 FFT 海洋、流体模拟、Shadertoy 等与作业无关的部分。

想看完整引擎（含多层级 FFT 海洋渲染管线）请切到 `main` 分支。

## 四次作业

| 作业    | 主题                     | 场景                  | 关键实现                                                                                   |
| ------- | ------------------------ | --------------------- | ------------------------------------------------------------------------------------------ |
| **HW1** | 实时阴影 Shadow Mapping  | Mary + 地板           | Hard Shadow / PCF / PCSS 三档可切；深度可选 RGBA 打包或 depth texture                      |
| **HW2** | 预计算辐射传输 PRT       | Mary + 环境立方体贴图 | 3 阶球谐（9 系数）传输向量逐顶点存储；unshadowed / shadowed / interreflection 三种传输模式 |
| **HW3** | 屏幕空间反射 SSR         | Cave + Cube           | 延迟渲染 G-Buffer → 深度 mipmap 层次加速 → 屏幕空间光线步进                                |
| **HW4** | Kulla-Conty 多次散射补偿 | 5×2 粗糙度球阵        | 上排 Cook-Torrance（仅单次散射），下排叠加 Kulla-Conty 补偿项；`E`/`Eavg` LUT 预计算       |

四个场景通过右上角 `switch scenes` 下拉菜单实时切换。

## 快速开始

前置：Node.js（见 `.nvmrc`）、支持 **WebGL 1.0** 的现代浏览器。

```bash
npm install
npm run dev
```

其他命令：

```bash
npm run build
```

```bash
npm run check
```

`check` = 类型检查（`tsc --noEmit`）+ ESLint 生产模式 + Prettier 格式校验。

## 目录结构

```
src/
├── engine.ts              引擎装配与主循环
├── main.ts                入口
├── renderers/
│   ├── BaseRenderer.ts    渲染器基类（持有 mesh + material + shader）
│   ├── WebGLRenderer.ts   RenderPass 调度器
│   └── passes/            shadow / forward / deferred(GBuffer·SSR) / overlay
├── objects/               Mesh、几何体、PRT 球谐网格
├── materials/             PBR / PRT / 环境 / 光源材质
├── shaders/               GLSL（运行时按路径加载，见 _config/shaderPaths.ts）
├── lights/                方向光、光源可视化、LightSystem
├── framebuffers/          FBO 封装（ShadowMap / GBuffer / DepthMipmap）
├── scenes/games202/       ⭐ 四次作业的场景装配
└── gui/                   dat.GUI / Tweakpane 面板
```

资源在 `public/assets/`：`models/hw1..hw4`（模型）、`data/prt/hw2`（球谐传输系数）、
`textures/environment`（立方体贴图与 HDR）、`textures/luts/pbr`（Kulla-Conty LUT）。

## 关于 shader 加载

GLSL 不走 ES module 导入，而是运行时按 URL 拉取：路径集中定义在
`src/shaders/_config/shaderPaths.ts`，构建时由 Vite 插件把 `src/shaders/` 整体复制到 `dist/shaders/`。

改 shader 无需重启开发服务器，刷新页面即可。

## 已知问题

- 切换场景时，上一个场景注册的 GUI 面板（如 HW3 的 `HW3 Cave Light`）不会被清理，会残留在面板上。功能不受影响。
- 离线预计算工具（Kulla-Conty LUT 生成、Nori 2 球谐预计算）不在本分支内——生成结果已直接放进 `public/assets/`。

## 许可

课程作业实现，仅供学习参考。模型与环境贴图资源版权归原作者所有。
