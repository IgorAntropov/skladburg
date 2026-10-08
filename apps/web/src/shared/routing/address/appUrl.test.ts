import {
  describe,
  expect,
  it,
} from 'vitest';

import type { AppAddressValue } from './addressTypes';

import {
  APP_SECTIONS,
  OBJECT_TYPES,
} from './addressTypes';
import {
  parseAppUrl,
  toAppUrl,
} from './appUrl';

const DEAL_ID = '00000000-0000-4000-8000-000000000001';
const PAGES_BASE = new URL('https://igorantropov.github.io/skladburg/');
const PREVIEW_BASE = new URL('http://localhost:4174/');
const PAGES_BASE_WITHOUT_SLASH = new URL('https://igorantropov.github.io/skladburg');

const dealAddress: AppAddressValue = { kind: 'object', object: { id: DEAL_ID, type: 'deal' } };

describe('toAppUrl', () => {
  it('builds a deal URL on Pages', () => {
    expect(toAppUrl(dealAddress, PAGES_BASE)).toBe(`https://igorantropov.github.io/skladburg/#/deals/${DEAL_ID}`);
  });

  it('builds a deal URL on the preview server', () => {
    expect(toAppUrl(dealAddress, PREVIEW_BASE)).toBe(`http://localhost:4174/#/deals/${DEAL_ID}`);
  });

  it('keeps a deal URL with a uuid within 100 characters', () => {
    expect(toAppUrl(dealAddress, PAGES_BASE).length).toBeLessThanOrEqual(100);
  });

  it('adds the missing trailing slash to the base path', () => {
    expect(toAppUrl({ kind: 'section', section: 'network' }, PAGES_BASE_WITHOUT_SLASH)).toBe(
      'https://igorantropov.github.io/skladburg/#/network',
    );
  });

  it('builds the home URL', () => {
    expect(toAppUrl({ kind: 'home' }, PREVIEW_BASE)).toBe('http://localhost:4174/#/');
  });
});

describe('parseAppUrl round trip', () => {
  const addresses: AppAddressValue[] = [
    { kind: 'home' },
    ...APP_SECTIONS.map((section): AppAddressValue => ({ kind: 'section', section })),
    ...OBJECT_TYPES.map((type): AppAddressValue => ({ kind: 'object', object: { id: DEAL_ID, type } })),
  ];

  it.each([PAGES_BASE, PREVIEW_BASE])('restores every address for the base %s', (base) => {
    for (const address of addresses) {
      expect(parseAppUrl(toAppUrl(address, base), base)).toEqual(address);
    }
  });
});

describe('parseAppUrl accepts', () => {
  it('the own URL with index.html', () => {
    expect(parseAppUrl(`https://igorantropov.github.io/skladburg/index.html#/deals/${DEAL_ID}`, PAGES_BASE)).toEqual(dealAddress);
  });

  it('the own URL without index.html', () => {
    expect(parseAppUrl(`https://igorantropov.github.io/skladburg/#/deals/${DEAL_ID}`, PAGES_BASE)).toEqual(dealAddress);
  });

  it('a bare fragment', () => {
    expect(parseAppUrl(`#/deals/${DEAL_ID}`, PAGES_BASE)).toEqual(dealAddress);
  });

  it('a fragment with parameters', () => {
    expect(parseAppUrl(`https://igorantropov.github.io/skladburg/#/deals/${DEAL_ID}?as=buyer`, PAGES_BASE)).toEqual(dealAddress);
  });

  it('a bare fragment with parameters', () => {
    expect(parseAppUrl(`#/network?as=buyer`, PAGES_BASE)).toEqual({ kind: 'section', section: 'network' });
  });

  it('surrounding whitespace from a scanner', () => {
    expect(parseAppUrl(`  http://localhost:4174/#/cells/${DEAL_ID}\r\n`, PREVIEW_BASE)).toEqual({
      kind: 'object',
      object: { id: DEAL_ID, type: 'cell' },
    });
  });

  it('an uppercase host', () => {
    expect(parseAppUrl(`https://IgorAntropov.github.io/skladburg/#/deals/${DEAL_ID}`, PAGES_BASE)).toEqual(dealAddress);
  });

  it('a base without the trailing slash', () => {
    expect(parseAppUrl(`https://igorantropov.github.io/skladburg/#/deals/${DEAL_ID}`, PAGES_BASE_WITHOUT_SLASH)).toEqual(dealAddress);
  });
});

describe('parseAppUrl rejects', () => {
  it.each([
    ['a foreign origin', `https://example.com/skladburg/#/deals/${DEAL_ID}`],
    ['a foreign subdomain', `https://evil.igorantropov.github.io/skladburg/#/deals/${DEAL_ID}`],
    ['a foreign sub path', `https://igorantropov.github.io/other/#/deals/${DEAL_ID}`],
    ['a nested sub path', `https://igorantropov.github.io/skladburg/other/#/deals/${DEAL_ID}`],
    ['the site root instead of the app path', `https://igorantropov.github.io/#/deals/${DEAL_ID}`],
    ['another document in the app path', `https://igorantropov.github.io/skladburg/404.html#/deals/${DEAL_ID}`],
    ['http instead of https', `http://igorantropov.github.io/skladburg/#/deals/${DEAL_ID}`],
    ['text without a fragment', 'https://igorantropov.github.io/skladburg/'],
    ['a URL with an empty fragment', 'https://igorantropov.github.io/skladburg/#'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a javascript URL with a fragment', `javascript:alert(1)//#/deals/${DEAL_ID}`],
    ['a data URL', `data:text/html,<p>#/deals/${DEAL_ID}</p>`],
    ['plain text', 'hello'],
    ['an empty string', ''],
    ['a barcode number', '4601234567893'],
    ['an unknown address in the fragment', 'https://igorantropov.github.io/skladburg/#/nope'],
    ['a bare unknown fragment', '#/nope'],
    ['a bare empty fragment', '#'],
  ])('%s', (_, text) => {
    expect(parseAppUrl(text, PAGES_BASE)).toBeUndefined();
  });

  it('a preview URL against the Pages base', () => {
    expect(parseAppUrl(`http://localhost:4174/#/deals/${DEAL_ID}`, PAGES_BASE)).toBeUndefined();
  });

  it('a Pages URL against the preview base', () => {
    expect(parseAppUrl(`https://igorantropov.github.io/skladburg/#/deals/${DEAL_ID}`, PREVIEW_BASE)).toBeUndefined();
  });

  it('another port on the preview host', () => {
    expect(parseAppUrl(`http://localhost:5173/#/deals/${DEAL_ID}`, PREVIEW_BASE)).toBeUndefined();
  });
});
