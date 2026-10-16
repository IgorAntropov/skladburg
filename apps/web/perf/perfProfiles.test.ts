import {
  describe,
  expect,
  it,
} from 'vitest';

import { selectPerfProfiles } from './perfProfiles.ts';

describe('selectPerfProfiles', () => {
  it('keeps the requested order', () => {
    expect(selectPerfProfiles(['desktop-fast-4g', 'mobile-fast-4g']).map(profile => profile.name)).toEqual([
      'desktop-fast-4g',
      'mobile-fast-4g',
    ]);
  });

  it('rejects an unknown name and lists the known ones', () => {
    expect(() => selectPerfProfiles(['mobile-3g'])).toThrow(/mobile-3g.*mobile-fast-4g/);
  });
});
