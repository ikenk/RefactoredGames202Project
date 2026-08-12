# OceanParams 迁移边界快照

本目录保存 `OceanParams` 从正式 FFT Ocean 主链退出时的最后一版迁移边界，供阅读重构过程。

## 原路径

- `src/simulation/ocean/fft/types/OceanParams.d.ts`
- `src/simulation/ocean/fft/createFFTOceanLayerPreparationInput.ts`
- `tests/unit/simulation/ocean/fft/createFFTOceanLayerPreparationInput.test.ts`

这些文件已经被以下正式边界替代：

- `FFTOceanLayerAuthoringConfig`：Scene、GUI 与持久化持有的可编辑状态；
- `createFFTOceanLayerBuildInputs()`：复制、校验并拆出各底层职责的窄输入；
- `FFTOceanLayerPreparationInput`：初始频谱和实时计算的准备输入；
- `FFTOceanLayerBlendConfig`：材质层混合输入。

本快照不参与 TypeScript、Vitest、ESLint 或 Vite 构建，也不承诺可以独立运行。
