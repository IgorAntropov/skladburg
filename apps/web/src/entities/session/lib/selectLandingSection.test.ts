import {
  describe,
  expect,
  it,
} from 'vitest';

import { selectLandingSection } from './selectLandingSection';

describe('selectLandingSection', () => {
  it('returns undefined for an empty list', () => {
    expect(selectLandingSection([])).toBeUndefined();
  });

  it('returns the first available section', () => {
    expect(selectLandingSection(['warehouse'])).toBe('warehouse');
    expect(selectLandingSection(['network', 'deals'])).toBe('network');
  });
});
