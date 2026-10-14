import {
  describe,
  expect,
  it,
} from 'vitest';

import { isSoftwareRendererName } from './isSoftwareRendererName';

describe('isSoftwareRendererName', () => {
  it.each([
    ['SwiftShader behind ANGLE in Chrome', 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'],
    ['llvmpipe', 'llvmpipe (LLVM 15.0.7, 256 bits)'],
    ['softpipe', 'softpipe'],
    ['Microsoft Basic Render Driver', 'Microsoft Basic Render Driver'],
    ['a generic software rasterizer', 'Mesa Software Rasterizer'],
  ])('recognises %s', (_title, name) => {
    expect(isSoftwareRendererName(name)).toBe(true);
  });

  it.each([
    ['Apple GPU', 'Apple GPU'],
    ['ANGLE Metal', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'],
    ['NVIDIA behind ANGLE', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'],
    ['an empty name', ''],
  ])('does not take %s for a software renderer', (_title, name) => {
    expect(isSoftwareRendererName(name)).toBe(false);
  });
});
