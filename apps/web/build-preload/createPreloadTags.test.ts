import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createPreloadTags,
  toPreloadHref,
} from './createPreloadTags.ts';

describe('toPreloadHref', () => {
  it('puts the file under the base with exactly one slash', () => {
    expect(toPreloadHref('/skladburg/', 'assets/a.js')).toBe('/skladburg/assets/a.js');
    expect(toPreloadHref('/skladburg', 'assets/a.js')).toBe('/skladburg/assets/a.js');
    expect(toPreloadHref('./', 'assets/a.js')).toBe('./assets/a.js');
    expect(toPreloadHref('', 'assets/a.js')).toBe('assets/a.js');
  });
});

describe('createPreloadTags', () => {
  it('makes a module preload link with the cross origin mode of the module scripts', () => {
    expect(createPreloadTags({ base: '/app/', fileNames: ['assets/a.js'], isLowPriority: false })).toEqual([
      {
        attrs: { crossorigin: true, href: '/app/assets/a.js', rel: 'modulepreload' },
        injectTo: 'head',
        tag: 'link',
      },
    ]);
  });

  it('marks low priority links and keeps the order of the files', () => {
    const tags = createPreloadTags({ base: '/app/', fileNames: ['assets/a.js', 'assets/b.js'], isLowPriority: true });

    expect(tags.map(tag => tag.attrs)).toEqual([
      { crossorigin: true, fetchpriority: 'low', href: '/app/assets/a.js', rel: 'modulepreload' },
      { crossorigin: true, fetchpriority: 'low', href: '/app/assets/b.js', rel: 'modulepreload' },
    ]);
  });

  it('makes no tags for no files', () => {
    expect(createPreloadTags({ base: '/', fileNames: [], isLowPriority: false })).toEqual([]);
  });
});
