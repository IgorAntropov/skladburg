import {
  describe,
  expect,
  it,
} from 'vitest';

import { createWorldModelGeometry } from './createWorldModelGeometry';
import { decodeWorldModelShade } from './format/worldModelFormat';
import { createTestWorldModel } from './worldModelTestSupport';

describe('createWorldModelGeometry', () => {
  const data = createTestWorldModel();
  const geometry = createWorldModelGeometry(data);

  it('keeps positions and indices of the model', () => {
    expect([...geometry.getAttribute('position').array]).toEqual([...data.positions]);
    expect(geometry.getAttribute('position').itemSize).toBe(3);
    expect([...(geometry.getIndex()?.array ?? [])]).toEqual([0, 1, 2]);
  });

  it('points uv at the center of the texel of the role', () => {
    const uv = geometry.getAttribute('uv');

    expect(uv.itemSize).toBe(2);
    expect([...uv.array]).toEqual([
      expect.closeTo(0.05, 6),
      0.5,
      expect.closeTo(0.35, 6),
      0.5,
      expect.closeTo(0.95, 6),
      0.5,
    ]);
  });

  it('writes the linear brightness of the shade into all three channels of the color', () => {
    const color = geometry.getAttribute('color');
    const expected = [0, 128, 255].map(byte => decodeWorldModelShade(byte) ** 2.2);

    expect(color.itemSize).toBe(3);

    for (const [vertex, brightness] of expected.entries()) {
      expect(color.getX(vertex)).toBeCloseTo(brightness, 5);
      expect(color.getY(vertex)).toBeCloseTo(brightness, 5);
      expect(color.getZ(vertex)).toBeCloseTo(brightness, 5);
    }
  });

  it('makes the dimmest shade darker and the brightest lighter than the neutral one', () => {
    const color = geometry.getAttribute('color');

    expect(color.getX(0)).toBeLessThan(1);
    expect(color.getX(2)).toBeGreaterThan(1);
  });
});
