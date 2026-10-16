import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  readLastSegment,
  readPathname,
} from './readUrlPath.ts';

describe('readPathname', () => {
  it('drops the origin, the query and the hash', () => {
    expect(readPathname('https://host/skladburg/assets/demo.js?v=1#x')).toBe('/skladburg/assets/demo.js');
  });

  it('reads a path without an origin', () => {
    expect(readPathname('/svc/GetSession')).toBe('/svc/GetSession');
  });
});

describe('readLastSegment', () => {
  it('returns the file name without the path and the query', () => {
    expect(readLastSegment('https://host/skladburg/assets/demo-zt3dE9Y4.js?v=1')).toBe('demo-zt3dE9Y4.js');
  });

  it('skips a trailing slash', () => {
    expect(readLastSegment('http://demo.local/svc/GetSession/')).toBe('GetSession');
  });
});
