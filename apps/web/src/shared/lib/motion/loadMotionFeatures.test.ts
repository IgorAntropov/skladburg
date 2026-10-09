import {
  describe,
  expect,
  it,
} from 'vitest';

import { loadMotionFeatures } from './loadMotionFeatures';

describe('loadMotionFeatures', () => {
  it('resolves to the feature bundle with a renderer and the animation features', async () => {
    const bundle = await loadMotionFeatures();

    expect(typeof bundle.renderer).toBe('function');
    expect(bundle.animation).toBeDefined();
    expect(bundle.exit).toBeDefined();
  });

  it('resolves to the same bundle on every call', async () => {
    const first = await loadMotionFeatures();
    const second = await loadMotionFeatures();

    expect(second).toBe(first);
  });
});
