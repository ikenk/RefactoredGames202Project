# FFT Ocean：multi-layer-v1

## 定位

从单层扩展到多层 cascade 的早期里程碑。该目录同时保存 scene v1 和早期
ComputePass v1，但必须注意：当前 scene v1 源码实际导入的是 ComputePass v2，
两者不是今天可以直接运行的一对。

本目录是冻结阅读参考，不进入正式 TypeScript、ESLint 或 Vite 构建链路。

## 移入本目录的文件及原路径

```text
src/scenes/water/fftOcean/loadFFTOceanScene-multi-layers-v1.ts
src/renderers/passes/fft/FFTOceanComputePass-multi-layers-v1.ts
```

## scene v1 当前实际依赖的历史文件

下面的 ComputePass v2 由 scene v1 和 scene v2 共享，因此归入
`reference/fft-ocean/multi-layer-v2/`：

```text
src/renderers/passes/fft/FFTOceanComputePass-multi-layers-v2.ts
src/simulation/ocean/fft/RealtimeSpectrum-v2.ts
src/simulation/ocean/fft/types/OceanSpectrumBuffers-refactor-v2.d.ts
```

## ComputePass v1 的历史共享原路径

```text
src/simulation/ocean/fft/RealtimeSpectrum-v1.ts
src/simulation/ocean/fft/NyquistCorrector.ts
src/simulation/ocean/fft/types/OceanSpectrumBuffers.d.ts
```

这些文件迁入 `reference/fft-ocean/_shared/cpu-spectrum-v1/`。

## 仍保留在现行 src 的共享原路径

```text
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
src/shaders/water/fftOcean/vertex-multi-layers.vert
src/shaders/water/fftOcean/fragment-multi-layers.frag
src/shaders/water/fftOcean/compute/**
```

## 已知限制

- 文件名版本与当前 import 图不完全一致；
- scene v1 使用旧 skybox renderer；
- 该目录用于比较 cascade 引入前后职责变化，不承诺独立运行。

## Git 线索

```text
f4a3483  2026-05-30  添加多层 scene v1/v2/v3
e4d2cac  2026-05-25  添加多层 ComputePass v1/v2/v3
```
