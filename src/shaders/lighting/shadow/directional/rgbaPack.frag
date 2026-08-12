#ifdef GL_ES
precision highp float;
#endif

// 把 float 深度值 pack 到 RGBA（WebGL 1 不能直接读 depth texture）
vec4 pack(float depth) {
  const vec4 bitShift = vec4(1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0);
  const vec4 bitMask = vec4(1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0, 0.0);
  vec4 rgbaDepth = fract(depth * bitShift);
  rgbaDepth -= rgbaDepth.gbaa * bitMask;
  return rgbaDepth;
}

// vec4 EncodeFloatRGBA(float v) {
//   vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * v;
//   enc = fract(enc);
//   enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
//   return enc;
// }

void main() {
  gl_FragColor = pack(gl_FragCoord.z);
  // gl_FragData[0] = EncodeFloatRGBA(gl_FragCoord.z * 100.0);
}
