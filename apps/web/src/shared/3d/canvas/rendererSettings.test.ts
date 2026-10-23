import { CustomToneMapping } from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { RENDERER_SETTINGS } from './rendererSettings';

describe('RENDERER_SETTINGS', () => {
  it('uses the custom tone mapping that the world curve replaces', () => {
    expect(RENDERER_SETTINGS.toneMapping).toBe(CustomToneMapping);
  });
});
