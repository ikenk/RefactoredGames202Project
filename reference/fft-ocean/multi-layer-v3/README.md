# FFT Ocean：multi-layer-v3

## 定位

将时变频谱计算迁到 GPU 的多层版本，并加入泡沫纹理、声明式 descriptor、
分层热/冷参数处理、持久化和 dat.GUI v3。

本目录是冻结阅读参考，不进入正式 TypeScript、ESLint 或 Vite 构建链路。

## 移入本目录的文件及原路径

```text
src/scenes/water/fftOcean/loadFFTOceanScene-multi-layers-v3.ts
src/gui/fftOcean/v2/setup.ts
src/gui/fftOcean/v3/setup.ts
src/gui/fftOcean/v3/descriptors.ts
src/gui/fftOcean/v3/hooks/usePersistence.ts
src/gui/fftOcean/v3/hooks/usePresets.ts
src/gui/fftOcean/v3/hooks/useTiering.ts
src/gui/fftOcean/types/setup-v2.d.ts
src/gui/fftOcean/types/setup-v3.d.ts
```

`src/gui/fftOcean/v2/` 只有 `setup.ts`；按目录整体移动即可。

## 必须保留在现行 src 的 v3/v4 共享原路径

```text
src/renderers/passes/fft/FFTOceanComputePass-multi-layers-v3.ts
src/simulation/ocean/fft/RealtimeSpectrumGPU.ts
src/scenes/water/fftOcean/_config/fftOceanSceneConfig-MultiLayers.ts
src/scenes/water/fftOcean/types/FFTOceanConfig-MultiLayers.d.ts
src/materials/water/FFTOceanMaterial-MultiLayers.ts
src/materials/water/types/FFTOceanMaterialConfig.d.ts
src/materials/water/_config/defaults.ts
src/renderers/factories/water/fftOcean/createFFTOceanRenderer-MultiLayers.ts
src/simulation/ocean/fft/ComplexBuffer.ts
src/simulation/ocean/fft/InitialSpectrum.ts
src/simulation/ocean/fft/types/OceanParams.d.ts
src/simulation/ocean/spectrums/JONSWAPSpectrum.ts
src/simulation/ocean/analysis/SpectrumAnalyzer.ts
src/shaders/water/fftOcean/vertex-multi-layers.vert
src/shaders/water/fftOcean/fragment-multi-layers.frag
src/shaders/water/fftOcean/compute/fftStockham/**
src/shaders/water/fftOcean/compute/packedAssembly/**
src/shaders/water/fftOcean/compute/realtimeSpectrum/**
```

这些文件也是现行 v4 的主链，不能执行 `mv`。若要恢复真正的 v3 快照，请从
Git commit 导出，而不是复制当前 v4 共享实现。

## 已知限制

- v3 和 v4 的主要区别在 GUI（dat.GUI 与 Tweakpane），不是完整渲染管线分叉；
- `src/gui/fftOcean/v3/hooks/useTiering.ts` 当前还引用 `setup-v2.d.ts`，所以
  `setup-v2.d.ts` 必须与 v3 GUI 一起保存；
- 本目录不是独立可运行示例。

## Git 线索

```text
6797243  2026-06-02  更新 GPU multi-layer v3 ComputePass
ddb5ccb  2026-06-05  添加声明式 dat.GUI v3
8ec7fdb  2026-06-05  后续添加 Tweakpane GUI v4
```
