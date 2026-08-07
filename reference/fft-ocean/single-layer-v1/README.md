# FFT Ocean：single-layer-v1

## 定位

最早的单层 FFT Ocean 阅读版本：一个 `OceanParams`、一个水面材质、一个
ComputePass，通过 CPU 生成时变频谱，再由 GPU Stockham IFFT 输出位移、梯度和
Jacobian 纹理。

本目录是冻结阅读参考，不进入正式 TypeScript、ESLint 或 Vite 构建链路。

## 移入本目录的文件及原路径

```text
src/scenes/water/fftOcean/loadFFTOceanScene-single-layer.ts
src/scenes/water/fftOcean/_config/fftOceanSceneConfig.ts
src/scenes/water/fftOcean/types/FFTOceanConfig.d.ts
src/materials/water/FFTOceanMaterial.ts
src/renderers/factories/water/fftOcean/createFFTOceanRenderer.ts
src/renderers/passes/fft/FFTOceanComputePass-single-layer.ts
src/shaders/water/fftOcean/vertex.vert
src/shaders/water/fftOcean/fragment.frag
```

## 历史共享文件

以下文件同样属于这条调用链，但同时服务过其他版本，迁入
`reference/fft-ocean/_shared/cpu-spectrum-v1/`：

```text
src/simulation/ocean/fft/RealtimeSpectrum-v1.ts
src/simulation/ocean/fft/NyquistCorrector.ts
src/simulation/ocean/fft/types/OceanSpectrumBuffers.d.ts
```

## 仍保留在现行 src 的共享原路径

```text
src/simulation/ocean/fft/ComplexBuffer.ts
src/simulation/ocean/fft/InitialSpectrum.ts
src/simulation/ocean/fft/types/OceanParams.d.ts
src/simulation/ocean/spectrums/Spectrum.ts
src/simulation/ocean/spectrums/PhillipsSpectrum.ts
src/materials/water/_config/defaults.ts
src/materials/water/types/FFTOceanMaterialConfig.d.ts
src/objects/WaterSurface.ts
src/renderers/BaseRenderer.ts
src/renderers/MeshRenderer.ts
src/renderers/passes/forward/ForwardRenderPass.ts
src/framebuffers/FBO.ts
src/objects/FullScreenQuad.ts
src/shaders/Shader.ts
src/shaders/_config/shaderPaths.ts
src/shaders/water/fftOcean/compute/fftStockham/FFTStockham.vert
src/shaders/water/fftOcean/compute/fftStockham/FFTStockham2D.frag
```

## 已知限制

- 迁移后不能直接运行，因为 alias 仍指向正式 `src`，部分历史文件又已移出 `src`；
- 单层材质字段与现行多层 `FFTOceanMaterialConfig` 已发生漂移；
- 当前目标是保留推导过程，不是维护第二套生产代码。

## Git 线索

```text
abb8b6c  2026-05-31  添加 FFT 海洋单层场景
e4d2cac  2026-05-25  添加单层/多层 FFT 计算通道
```
