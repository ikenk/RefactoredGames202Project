/**
 * WebGL 能力检测结果（GL Capabilities）
 *
 * 👉 用于：
 * - 在初始化阶段检测 GPU / 浏览器支持情况
 * - 决定渲染路径（fallback / degrade）
 * - 避免运行时错误（如不支持的纹理格式）
 *
 * 👉 通常来源：
 * - gl.getExtension(...)
 *
 * ---
 *
 * ⚠️ 为什么必须做 capability 检测？
 *
 * WebGL 是“软标准”：
 * - 不同 GPU / 浏览器支持的扩展不同
 * - 同一功能可能需要扩展才能启用
 *
 * 👉 不检测的后果：
 * - framebuffer incomplete
 * - 纹理无法采样
 * - 渲染结果全黑
 */
export interface GLCapabilities {
  /**
   * 是否支持浮点纹理（32-bit float texture）
   *
   * 👉 对应扩展：
   * - WebGL1: OES_texture_float
   * - WebGL2: 内建支持
   *
   * 👉 用途：
   * - HDR 渲染（高动态范围）
   * - G-buffer（延迟渲染）
   * - 物理模拟（如 FFT 水面）
   *
   * ❗ 不支持时：
   * - 无法使用 gl.FLOAT 作为纹理数据类型
   */
  floatTexture: boolean

  /**
   * 是否支持半浮点纹理（16-bit float / half float）
   *
   * 👉 对应扩展：
   * - WebGL1: OES_texture_half_float
   * - WebGL2: 内建支持
   *
   * 👉 优势：
   * - 比 float 节省显存（16bit vs 32bit）
   * - 精度足够用于大多数 HDR 场景
   *
   * 👉 常见用途：
   * - 后处理（Bloom / SSR / SSAO）
   *
   * ❗ 不支持时：
   * - 只能 fallback 到 UNSIGNED_BYTE（精度损失明显）
   */
  halfFloatTexture: boolean

  /**
   * 是否支持浮点纹理的线性过滤（LINEAR filtering）
   *
   * 👉 对应扩展：
   * - OES_texture_float_linear
   * - OES_texture_half_float_linear
   *
   * 👉 作用：
   * - 允许对 float / half-float texture 使用：
   *   gl.LINEAR / gl.LINEAR_MIPMAP_LINEAR
   *
   * ❗ 不支持时：
   * - 只能使用 gl.NEAREST（最近邻采样）
   *
   * 👉 影响：
   * - 后处理会出现 blocky / 像素化
   * - SSAO / SSR / Bloom 效果明显变差
   */
  floatLinearFilter: boolean

  /**
   * 是否支持深度纹理（Depth Texture）
   *
   * 👉 对应扩展：
   * - WebGL1: WEBGL_depth_texture
   * - WebGL2: 内建支持
   *
   * 👉 用途：
   * - Shadow Mapping（核心）
   * - SSAO（读取深度）
   * - 屏幕空间效果（SSR / DOF）
   *
   * 👉 能力：
   * - 可以将 depth attachment 作为 texture 采样
   *
   * ❗ 不支持时：
   * - 无法直接读取深度
   * - 需要手动 pack depth → color（精度差 + 麻烦）
   */
  depthTexture: boolean

  /**
   * 是否支持多渲染目标（Multiple Render Targets, MRT）
   *
   * 👉 对应扩展：
   * - WebGL1: WEBGL_draw_buffers
   * - WebGL2: 内建支持（gl.drawBuffers）
   *
   * 👉 用途：
   * - 延迟渲染（Deferred Rendering）
   * - 一次 pass 输出多个 buffer（G-buffer）
   *
   * 👉 示例：
   * - position / normal / albedo 同时写入
   *
   * ❗ 不支持时：
   * - 必须拆成多 pass（性能下降）
   */
  drawBuffers: boolean

  /**
   * 是否支持 shader 中手动控制 LOD（texture LOD sampling）
   *
   * 👉 对应扩展：
   * - WebGL1: EXT_shader_texture_lod
   * - WebGL2: 内建支持（textureLod / textureGrad）
   *
   * 👉 作用：
   * - 在 shader 中手动指定 mipmap level
   * - 可绕过默认的隐式导数计算
   *
   * 👉 常见用途：
   * - FFT 海面（频谱采样控制）
   * - 环境贴图 prefilter（IBL）
   * - 屏幕空间效果（SSR / refraction）
   *
   * ❗ 不支持时：
   * - 只能使用 texture2D（自动 LOD）
   * - 无法精确控制采样模糊程度
   *
   * ⚠️ 注意：
   * - 仅影响 shader（GLSL），不影响 CPU API
   */
  textureLOD: boolean

  /**
   * 是否支持渲染到半浮点颜色缓冲
   *
   * 👉 对应扩展：EXT_color_buffer_half_float
   * 👉 用途：移动端把 FFT FBO 从 float32 降到 fp16 渲染目标（省带宽、提吞吐）
   * ❗ 不支持时：无法把 half-float 纹理作为 framebuffer attachment
   */
  colorBufferHalfFloat: boolean

  /**
   * 是否支持渲染到浮点颜色缓冲（Floating Point Color Buffer）
   *
   * 对应扩展：
   * - WebGL1: WEBGL_color_buffer_float
   * - WebGL2: 内建支持（可以直接用 gl.RGBA32F 附加到 framebuffer）
   *
   * 作用：
   * - 允许 framebuffer 的 color attachment 使用浮点纹理（32-bit float）
   * - 关键用于 HDR 渲染、G-buffer、物理模拟等
   * - 通常和 gl.FLOAT 数据类型配合使用
   *
   * ❗ 不支持时：
   * - 即便支持 float 纹理，也无法直接渲染到它
   * - 只能 fallback 到 UNSIGNED_BYTE 或半浮点纹理
   *
   * ⚠️ 与 floatTexture 的区别：
   * - floatTexture 只检测 GPU/浏览器是否支持浮点纹理本身（gl.FLOAT 作为纹理数据类型）
   * - colorBufferFloat 则进一步要求支持把浮点纹理作为 framebuffer 的 render target
   *   （gl.framebufferTexture2D attachment 可用 gl.FLOAT）
   *
   * 👉 举例：
   * const colorBufferFloat = !!gl.getExtension('WEBGL_color_buffer_float');
   */
  colorBufferFloat: boolean

  /**
   * 是否支持对 framebuffer 附加的 mipmap level > 0 的渲染
   *
   * 对应扩展：
   * - WebGL1: OES_fbo_render_mipmap
   * - WebGL2: 内建支持（可以直接渲染到任意 mip level）
   *
   * 作用：
   * - 默认 WebGL1 不允许 gl.framebufferTexture2D 时 level > 0
   * - 该扩展解除限制，允许渲染到 cubemap 或普通纹理的任意 mipmap 层
   * - 常用于 IBL 预滤波（prefiltered environment map）
   *
   * ❗ 不支持时：
   * - 无法生成预滤波的环境贴图 mip
   * - 只能渲染到 base level（level=0）
   *
   * ⚠️ 注意：
   * - 只影响 framebuffer 渲染的 mip level，纹理采样本身仍可使用 mipmap
   * - 在现代浏览器 (Chrome / Firefox / Safari) WebGL1 下通常支持
   *
   * 👉 示例：
   * const fboMipmap = !!gl.getExtension('OES_fbo_render_mipmap');
   * if (!fboMipmap) {
   *   throw new Error('OES_fbo_render_mipmap not supported. IBL prefilter requires rendering to non-zero mip levels.');
   * }
   */
  fboRenderMipmap: boolean

  /**
   * 是否支持屏幕空间导数（Standard Derivatives）
   *
   * 👉 对应扩展：
   * - WebGL1: OES_standard_derivatives
   * - WebGL2: 内建支持
   *
   * 👉 作用：
   * - 在 fragment shader 中使用：
   *   - dFdx()
   *   - dFdy()
   *   - fwidth()
   *
   * 👉 本质：
   * - 提供基于屏幕空间（pixel quad）的数值导数
   * - 用于计算变量在屏幕上的变化率
   *
   * 👉 常见用途：
   * - 法线重建（height → normal）
   * - procedural anti-aliasing（基于 fwidth）
   * - 边缘检测 / 梯度计算
   * - 水面 foam / slope 分析
   *
   * ❗ 不支持时：
   * - 无法使用 dFdx / dFdy / fwidth
   * - 无法进行基于导数的抗锯齿
   * - 需要 fallback 到：
   *   - 手动采样（多次 texture fetch）
   *   - 或放弃部分效果
   *
   * ⚠️ 注意：
   * - 仅在 fragment shader 可用（vertex shader 不支持）
   * - 即使 JS 获取扩展成功，shader 中仍需：
   *   #extension GL_OES_standard_derivatives : enable
   *
   * 👉 示例：
   * const derivatives = !!gl.getExtension('OES_standard_derivatives');
   */
  standardDerivatives: boolean

  /**
   * 是否支持 32-bit 索引（uint32 element index）
   *
   * 👉 对应扩展：
   * - WebGL1: OES_element_index_uint
   * - WebGL2: 内建支持
   *
   * 👉 作用：
   * - 允许 gl.drawElements 使用 gl.UNSIGNED_INT（32 bit）作为索引类型
   * - 突破 gl.UNSIGNED_SHORT（16 bit）的 65535 顶点上限
   *
   * 👉 常见用途（本项目关键）：
   * - 高分辨率 mesh（FFT 海面 surfaceMeshResolution=1024 → 1M+ 顶点）
   * - 单一大场景共用一个 IBO
   *
   * ❗ 不支持时：
   * - 单个 IBO 的索引值受限于 65535
   * - 需要拆分 mesh，或改用 gl.drawArrays（无索引绘制，重复顶点 → 显存浪费）
   *
   * ⚠️ 注意：
   * - WebGL1 必须显式 gl.getExtension('OES_element_index_uint') 才生效
   * - 只影响 gl.drawElements 的 type 参数；不影响 attribute 数据本身
   *
   * 👉 示例：
   * const elementIndexUint = !!gl.getExtension('OES_element_index_uint');
   */
  elementIndexUint: boolean

  /**
   * 默认 framebuffer 每通道位深 [R, G, B, A]
   *
   * 👉 来源：
   * - gl.getParameter(gl.RED_BITS / GREEN_BITS / BLUE_BITS / ALPHA_BITS)
   *
   * 👉 用途：
   * - 确认后备缓冲格式（通常 [8,8,8,8] = RGBA8）
   * - RGBA8 → shader 输出在写入时被 clamp 到 [0,1]，因此必须 tone map
   * - ALPHA 位为 0 表示 getContext 时传了 { alpha: false }
   *
   * ❗ 注意：
   * - WebGL1 默认缓冲固定 8 位 UNORM，无法改成 float（HDR 需另开离屏 FBO）
   */
  colorBits: [number, number, number, number]

  /**
   * 默认 framebuffer 的深度缓冲位深
   *
   * 👉 来源：
   * - gl.getParameter(gl.DEPTH_BITS)
   *
   * 👉 用途：
   * - 典型值 16 / 24，决定深度精度
   * - 位数越低，远处越容易 z-fighting（深度打架）
   *
   * ❗ 为 0 时：
   * - 没有深度缓冲（getContext 传了 { depth: false }）→ 无法做深度测试
   */
  depthBits: number

  /**
   * 实际生效的 WebGL 上下文属性
   *
   * 👉 来源：
   * - gl.getContextAttributes()
   *
   * 👉 用途：
   * - 验证"请求的"与"实际拿到的"是否一致（请求 ≠ 一定满足）
   * - 关注字段：alpha / antialias / premultipliedAlpha / depth / stencil
   *   - premultipliedAlpha: true → alpha<1 时按预乘 alpha 与网页合成
   *   - antialias: true → 默认缓冲启用了 MSAA
   *
   * ❗ 为 null 时：
   * - 上下文已丢失（context lost）
   */
  contextAttributes: WebGLContextAttributes | null

  /**
   * 单张 2D 纹理的最大边长（像素）
   *
   * 👉 来源：
   * - gl.getParameter(gl.MAX_TEXTURE_SIZE)
   *
   * 👉 用途：
   * - 确认能否分配你需要的纹理：FFT cascade(256)、2K skybox/IBL(2048)、foam(1024)
   * - 典型值 4096 / 8192 / 16384
   *
   * ❗ 超出上限时：
   * - texImage2D 报 INVALID_VALUE，纹理创建失败
   */
  maxTextureSize: number

  /**
   * 顶点着色器可用的纹理单元数
   *
   * 👉 来源：
   * - gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)
   *
   * 👉 用途（本项目关键）：
   * - FFT 海面在【顶点着色器】采样 displacement map 做顶点位移
   * - 需 ≥ 同时采样的 cascade 层数
   *
   * ❗ 不支持时（某些老/移动 GPU = 0）：
   * - 顶点纹理采样失效 → 海面变平，完全不起伏
   */
  maxVertexTextureUnits: number

  /**
   * 片元着色器可用的纹理单元数
   *
   * 👉 来源：
   * - gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
   *
   * 👉 用途（本项目关键）：
   * - 你 fragment 里绑了 4 层 ×3 张 FFT 图 + prefilter envmap + BRDF LUT + foam
   * - 移动端常仅 8~16，容易逼近上限
   *
   * ❗ 超出时：
   * - 多余的 sampler 拿不到纹理单元 → 采样全黑或链接失败
   */
  maxFragmentTextureUnits: number

  /**
   * 顶点 → 片元之间可传递的 varying 向量数
   *
   * 👉 来源：
   * - gl.getParameter(gl.MAX_VARYING_VECTORS)
   *
   * 👉 用途：
   * - 你的 vertex 输出 vWorldPosition / vWorldXZ / vSampleWorldXZ / vClipDepth 等
   * - 移动端常仅 8，varying 多时会超
   *
   * ❗ 超出时：
   * - shader 链接失败（link error）
   */
  maxVaryingVectors: number

  /**
   * 顶点着色器可用的 uniform 向量数
   *
   * 👉 来源：
   * - gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)
   *
   * 👉 用途：
   * - 评估 per-layer uniform（uLayerSize/uLayerContribute…）+ 矩阵的预算
   *
   * ❗ 超出时：
   * - 顶点 shader 编译/链接失败
   */
  maxVertexUniformVectors: number

  /**
   * 片元着色器可用的 uniform 向量数
   *
   * 👉 来源：
   * - gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)
   *
   * 👉 用途：
   * - 你 fragment 的 SSS / Cook-Torrance / IBL / foam / fog 参数很多
   * - 移动端常仅 64~221，需评估是否够用
   *
   * ❗ 超出时：
   * - 片元 shader 编译失败（"too many uniforms"）
   */
  maxFragmentUniformVectors: number

  /**
   * 片元着色器是否真正支持 highp 浮点精度
   *
   * 👉 来源：
   * - gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0
   *
   * 👉 用途（移动端关键）：
   * - Beckmann NDF / Fresnel / 法线重建等依赖 highp
   *
   * ❗ 不支持时（部分移动 GPU 片元只到 mediump）：
   * - 高光、法线出现 banding / 噪点
   *
   * ⚠️ 注意：
   * - 顶点 shader 的 highp 几乎总是支持；受限的主要是【片元】
   */
  fragHighpSupported: boolean

  /**
   * GPU 渲染器型号字符串（如 "Apple M1", "Intel UHD 630"）
   *
   * 👉 来源：
   * - WEBGL_debug_renderer_info 的 UNMASKED_RENDERER_WEBGL
   *
   * 👉 用途：
   * - 排查"为什么这台机器慢"的第一手信息（独显 / 集显 / 移动 GPU）
   *
   * ❗ 不支持时（部分浏览器出于隐私屏蔽该扩展）：
   * - 返回 "unknown"
   */
  gpuRenderer: string

  /**
   * GPU 厂商字符串（如 "Apple", "Google Inc. (Intel)"）
   *
   * 👉 来源：
   * - WEBGL_debug_renderer_info 的 UNMASKED_VENDOR_WEBGL
   *
   * 👉 用途：
   * - 配合 gpuRenderer 做厂商级 workaround / 降级判断
   *
   * ❗ 不支持时：
   * - 返回 "unknown"
   */
  gpuVendor: string

  /**
   * OES_vertex_array_object 扩展对象（不是 boolean）。
   *
   * 与其它能力位不同，这里存的是对象本身 —— 因为 VAO 的 API
   * (createVertexArrayOES / bindVertexArrayOES / deleteVertexArrayOES)
   * 挂在扩展对象上，只留 boolean 会把它丢掉。
   * null 表示不支持。
   */
  vertexArrayObject: OES_vertex_array_object | null
}
