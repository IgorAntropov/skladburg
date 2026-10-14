import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSquareWorld } from '../world/sceneWorld';
import { computeShadowFrustum } from './computeShadowFrustum';

describe('computeShadowFrustum', () => {
  it('centers the frustum on the middle of the world bounds at half of the decor height', () => {
    const frustum = computeShadowFrustum({
      bounds: { maxX: 30, maxZ: 70, minX: 10, minZ: 20 },
      home: { centerX: 0, centerZ: 0, radius: 1 },
      maxHeight: 12,
    });

    expect(frustum.centerX).toBe(20);
    expect(frustum.centerY).toBe(6);
    expect(frustum.centerZ).toBe(45);
  });

  it('covers the whole world box with a sphere of half the box diagonal', () => {
    const frustum = computeShadowFrustum(createSquareWorld(192));

    const farthestCornerDistance = Math.hypot(96, 6, 96);

    expect(frustum.halfExtent).toBeCloseTo(Math.hypot(192, 192, 12) / 2, 6);
    expect(frustum.halfExtent).toBeGreaterThanOrEqual(farthestCornerDistance);
  });

  it('keeps the whole sphere between the near and far planes for any light direction', () => {
    const frustum = computeShadowFrustum(createSquareWorld(192));

    expect(frustum.near).toBeGreaterThan(0);
    expect(frustum.near).toBeLessThan(frustum.distance - frustum.halfExtent);
    expect(frustum.far).toBeGreaterThan(frustum.distance + frustum.halfExtent);
  });

  it('grows with the world', () => {
    const small = computeShadowFrustum(createSquareWorld(96));
    const large = computeShadowFrustum(createSquareWorld(192));

    expect(large.halfExtent).toBeGreaterThan(small.halfExtent);
  });
});
