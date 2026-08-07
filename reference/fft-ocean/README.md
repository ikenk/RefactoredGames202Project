# FFT Ocean 历史实现索引

本目录保存 FFT Ocean 从单层到多层 GPU 频谱版本的阅读参考。历史文件已经离开正式
`src`，不会参与 TypeScript、ESLint 与 Vite 构建。

## 版本索引

| 目录 | 主要变化 | 状态 |
|---|---|---|
| `single-layer-v1/` | 单层 OceanParams、CPU 时变频谱、GPU Stockham IFFT | 冻结阅读参考 |
| `multi-layer-v1/` | 引入 cascade 的早期场景与 ComputePass 里程碑 | 冻结阅读参考 |
| `multi-layer-v2/` | CPU RealtimeSpectrum v2、packed assembly、IBL、dat.GUI v1 | 冻结阅读参考 |
| `multi-layer-v3/` | GPU RealtimeSpectrum、泡沫、descriptor/hooks、dat.GUI v3 | 冻结阅读参考 |
| `_shared/` | 被多个历史版本共同使用的 CPU 频谱与 Shader 备份 | 冻结共享参考 |

## 现行版本

现行主链继续位于正式源码，入口是：

```text
src/scenes/water/fftOcean/loadFFTOceanScene-multi-layers-v4.ts
```

v4 继续共享 `FFTOceanComputePass-multi-layers-v3.ts`、GPU RealtimeSpectrum、多层材质、
多层 Shader 和 JONSWAP 频谱。历史 README 中列出的共享路径是为了阅读调用链，不能随
历史入口一起移动。

## 阅读约定

- 每个版本 README 的“原路径”指迁移前的项目路径；
- 这些目录不承诺直接运行；
- 需要可运行的精确历史版本时，从 README 提供的 Git commit 导出；
- 不把今天的共享文件复制到旧目录并称为历史快照。
