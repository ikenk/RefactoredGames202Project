# FFT Ocean：multi-layer-v2

## 定位

CPU RealtimeSpectrum v2 + packed IFFT/assembly 的多层版本，并加入 HDR 环境处理、
IBL、BRDF LUT、频谱分析和第一版 dat.GUI 控制。

本目录是冻结阅读参考，不进入正式 TypeScript、ESLint 或 Vite 构建链路。

## 移入本目录的文件及原路径

```text
src/scenes/water/fftOcean/loadFFTOceanScene-multi-layers-v2.ts
src/renderers/passes/fft/FFTOceanComputePass-multi-layers-v2.ts
src/simulation/ocean/fft/RealtimeSpectrum-v2.ts
src/simulation/ocean/fft/types/OceanSpectrumBuffers-refactor-v2.d.ts
src/gui/fftOcean/v1/setup.ts
src/gui/fftOcean/types/setup-v1.d.ts
```

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
src/simulation/ocean/analysis/SpectrumAnalyzer.ts
src/textures/cubemap/linearizeCubemap.ts
src/textures/cubemap/IBL/prefilterEnvironment.ts
src/textures/cubemap/IBL/generateBRDFLUT.ts
src/shaders/water/fftOcean/vertex-multi-layers.vert
src/shaders/water/fftOcean/fragment-multi-layers.frag
src/shaders/water/fftOcean/compute/fftStockham/**
src/shaders/water/fftOcean/compute/packedAssembly/**
```

## 已知限制

- scene v1 也引用本目录中的 ComputePass v2，所以 v1 README 会跨目录引用它；
- GUI v1 修改冷参数时依赖 ComputePass 的重建接口；
- 共享配置已经继续演化，不能把今天的配置复制过来冒充 v2 原貌。

## Git 线索

```text
918da19  2026-06-03  更新 multi-layer v2 场景加载逻辑
da571f4  2026-06-02  GUI v1/v2 迁入版本目录
c6c4f88  2026-05-31  更新 FFT 计算通道
```
