import {
  describe,
  expect,
  it,
} from 'vitest';

import { readLinkedHrefs } from './readLinkedHrefs.ts';

describe('readLinkedHrefs', () => {
  it('reads the addresses of scripts and links in any attribute order', () => {
    const html = [
      '<script type="module" crossorigin src="/app/assets/index.js"></script>',
      '<link rel="modulepreload" crossorigin href="/app/assets/react.js">',
      '<link crossorigin href="/app/assets/mount.js" rel="modulepreload">',
      '<link rel="stylesheet" href="/app/assets/index.css">',
    ].join('\n');

    expect([...readLinkedHrefs(html)]).toEqual([
      '/app/assets/index.js',
      '/app/assets/react.js',
      '/app/assets/mount.js',
      '/app/assets/index.css',
    ]);
  });

  it('reads nothing from a page without links', () => {
    expect(readLinkedHrefs('<html><body><a>text</a></body></html>').size).toBe(0);
  });
});
