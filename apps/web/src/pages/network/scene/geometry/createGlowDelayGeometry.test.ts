import {
  BoxGeometry,
  InstancedBufferAttribute,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { WORLD_GLOW_DELAY_ATTRIBUTE } from '@/shared/3d';

import {
  attachGlowDelays,
  createGlowDelayGeometry,
} from './createGlowDelayGeometry';

describe('createGlowDelayGeometry', () => {
  it('puts the delays on a copy as a per-instance attribute and leaves the source alone', () => {
    const source = new BoxGeometry(1, 1, 1);
    const delays = new Float32Array([0.4, 0.5, 0.6]);
    const geometry = createGlowDelayGeometry(source, delays);
    const attribute = geometry.getAttribute(WORLD_GLOW_DELAY_ATTRIBUTE);

    expect(geometry).not.toBe(source);
    expect(attribute).toBeInstanceOf(InstancedBufferAttribute);
    expect(attribute.itemSize).toBe(1);
    expect(attribute.count).toBe(3);
    expect(attribute.array).toBe(delays);
    expect(source.hasAttribute(WORLD_GLOW_DELAY_ATTRIBUTE)).toBe(false);
    expect(geometry.getAttribute('position').count).toBe(source.getAttribute('position').count);
  });

  it('puts the delays on the geometry itself without a copy', () => {
    const source = new BoxGeometry(1, 1, 1);
    const delays = new Float32Array([0.1, 0.2]);
    const geometry = attachGlowDelays(source, delays);

    expect(geometry).toBe(source);
    expect(geometry.getAttribute(WORLD_GLOW_DELAY_ATTRIBUTE).array).toBe(delays);
  });
});
