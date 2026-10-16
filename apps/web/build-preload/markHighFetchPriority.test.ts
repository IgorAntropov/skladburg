import {
  describe,
  expect,
  it,
} from 'vitest';

import { markHighFetchPriority } from './markHighFetchPriority.ts';

const ENTRY_HREF = '/app/assets/index-A.js';

const HTML = [
  '<html><head>',
  '<script>(function(){var s="<link rel=\'stylesheet\'>"})()</script>',
  `<script type="module" crossorigin src="${ENTRY_HREF}"></script>`,
  '<link rel="modulepreload" crossorigin href="/app/assets/react-B.js">',
  '<link rel="stylesheet" crossorigin href="/app/assets/index-C.css">',
  '<link rel="icon" href="/app/favicon.svg" type="image/svg+xml">',
  '<script type="module" crossorigin src="/app/assets/other-D.js"></script>',
  '</head><body></body></html>',
].join('\n');

describe('markHighFetchPriority', () => {
  it('marks the entry script and the stylesheet', () => {
    const { html } = markHighFetchPriority(HTML, ENTRY_HREF);

    expect(html).toContain(`<script fetchpriority="high" type="module" crossorigin src="${ENTRY_HREF}"></script>`);
    expect(html).toContain('<link fetchpriority="high" rel="stylesheet" crossorigin href="/app/assets/index-C.css">');
  });

  it('marks nothing else', () => {
    const { html } = markHighFetchPriority(HTML, ENTRY_HREF);

    expect(html.match(/fetchpriority/g)).toHaveLength(2);
    expect(html).toContain('<link rel="modulepreload" crossorigin href="/app/assets/react-B.js">');
    expect(html).toContain('<script type="module" crossorigin src="/app/assets/other-D.js"></script>');
    expect(html).toContain('<link rel="icon" href="/app/favicon.svg" type="image/svg+xml">');
  });

  it('keeps the rest of the page as it was', () => {
    const { html } = markHighFetchPriority(HTML, ENTRY_HREF);

    expect(html.replaceAll(' fetchpriority="high"', '')).toBe(HTML);
  });

  it('reports that the entry script is in the page', () => {
    expect(markHighFetchPriority(HTML, ENTRY_HREF).hasEntryScript).toBe(true);
  });

  it('reports that the entry script is missing and leaves the scripts alone', () => {
    const result = markHighFetchPriority(HTML, '/app/assets/missing.js');

    expect(result.hasEntryScript).toBe(false);
    expect(result.html.match(/fetchpriority/g)).toHaveLength(1);
  });

  it('does not mark a tag twice', () => {
    const once = markHighFetchPriority(HTML, ENTRY_HREF).html;

    expect(markHighFetchPriority(once, ENTRY_HREF).html).toBe(once);
  });

  it('keeps a priority that the tag already has', () => {
    const html = `<script type="module" fetchpriority="low" src="${ENTRY_HREF}"></script>`;

    expect(markHighFetchPriority(html, ENTRY_HREF).html).toBe(html);
  });

  it('takes the address of the script whole and not by its ending', () => {
    const html = `<script type="module" src="/other${ENTRY_HREF}"></script>`;

    expect(markHighFetchPriority(html, ENTRY_HREF).hasEntryScript).toBe(false);
  });
});
