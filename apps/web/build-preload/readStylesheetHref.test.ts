import {
  describe,
  expect,
  it,
} from 'vitest';

import { readStylesheetHref } from './readStylesheetHref.ts';

describe('readStylesheetHref', () => {
  it('reads the address of the stylesheet link whatever the order of its attributes', () => {
    expect(readStylesheetHref('<link rel="stylesheet" crossorigin href="/app/assets/index.css">')).toBe('/app/assets/index.css');
    expect(readStylesheetHref('<link fetchpriority="high" href="/app/assets/a.css" rel="stylesheet">')).toBe('/app/assets/a.css');
  });

  it('skips the links that are not stylesheets', () => {
    const html = [
      '<link rel="modulepreload" crossorigin href="/app/assets/react.js">',
      '<link rel="icon" href="/app/favicon.svg">',
      '<link rel="stylesheet" href="/app/assets/index.css">',
    ].join('');

    expect(readStylesheetHref(html)).toBe('/app/assets/index.css');
  });

  it('reads the first stylesheet when the page has several', () => {
    const html = '<link rel="stylesheet" href="/app/assets/a.css"><link rel="stylesheet" href="/app/assets/b.css">';

    expect(readStylesheetHref(html)).toBe('/app/assets/a.css');
  });

  it('finds nothing when the page has no stylesheet', () => {
    expect(readStylesheetHref('<link rel="modulepreload" href="/app/assets/react.js">')).toBeUndefined();
    expect(readStylesheetHref('<link rel="stylesheet">')).toBeUndefined();
  });
});
