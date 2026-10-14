import { readFileSync } from 'node:fs';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { themeBootScriptPlugin } from '../build-theme/themeBootScriptPlugin.ts';
import { BOOT_FALLBACK_ELEMENT_ID } from '../src/app/bootstrap/bootFallbackConstants.ts';
import { bootFallbackPlugin } from './bootFallbackPlugin.ts';
import { createBootFallbackScript } from './createBootFallbackScript.ts';

const MESSAGES = { message: 'Не загрузилось', reload: 'Обновить' };

const CHARSET_TAG = '<meta charset="UTF-8" />';

const MAX_CHARSET_OFFSET_BYTES = 1024;

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const transform = (html: string, messages = MESSAGES): string => {
  return bootFallbackPlugin({ messages }).transformIndexHtml.handler(html);
};

const prependThemeTags = (html: string): string => {
  const [meta, script] = themeBootScriptPlugin().transformIndexHtml.handler();
  const themeMeta = `<meta content="${meta?.attrs?.content as string}" name="theme-color">`;

  return html.replace('<head>', `<head>${themeMeta}<script>${script?.children as string}</script>`);
};

const byteOffsetOf = (html: string, fragment: string): number => Buffer.from(html).indexOf(fragment);

describe('bootFallbackPlugin', () => {
  it('runs before other transforms of the index html', () => {
    expect(bootFallbackPlugin({ messages: MESSAGES }).transformIndexHtml.order).toBe('pre');
  });

  it('puts the style and the script right after the charset meta', () => {
    const html = transform(indexHtml);
    const charsetEnd = html.indexOf(CHARSET_TAG) + CHARSET_TAG.length;

    const script = createBootFallbackScript({ elementId: BOOT_FALLBACK_ELEMENT_ID, rootId: 'root' });

    expect(html.slice(charsetEnd)).toMatch(/^<style>#boot-fallback:not\(\[hidden\]\)\{display:flex\}[^<]*<\/style>/);
    expect(html.slice(charsetEnd)).toContain(`</style><script>${script}</script>`);
  });

  it('keeps the charset meta at the same byte offset', () => {
    expect(byteOffsetOf(transform(indexHtml), CHARSET_TAG)).toBe(byteOffsetOf(indexHtml, CHARSET_TAG));
  });

  it('keeps the charset meta within the first 1024 bytes after the theme tags are prepended', () => {
    const html = prependThemeTags(transform(indexHtml));

    expect(byteOffsetOf(html, CHARSET_TAG) + CHARSET_TAG.length).toBeLessThanOrEqual(MAX_CHARSET_OFFSET_BYTES);
  });

  it('puts the hidden block after the root and before the end of the body', () => {
    const html = transform(indexHtml);
    const blockStart = html.indexOf(`<div id="${BOOT_FALLBACK_ELEMENT_ID}" hidden`);

    expect(blockStart).toBeGreaterThan(html.indexOf('<div id="root">'));
    expect(blockStart).toBeLessThan(html.indexOf('</body>'));
    expect(html).toContain('data-testid="boot-fallback-reload"');
  });

  it('puts the texts into the block', () => {
    const html = transform(indexHtml);

    expect(html).toContain('<p>Не загрузилось</p>');
    expect(html).toContain('>Обновить</button>');
  });

  it('escapes the texts', () => {
    const html = transform(indexHtml, { message: '<img src=x onerror=alert(1)>', reload: '"&' });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;&amp;');
  });

  it('does not read dollar signs in the texts as replacement patterns', () => {
    const html = transform(indexHtml, { message: '$& $1 $`', reload: '$$' });

    expect(html).toContain('<p>$&amp; $1 $`</p>');
    expect(html).toContain('>$$</button>');
  });

  it('fails with a clear message when the charset meta is missing', () => {
    const html = indexHtml.replace(CHARSET_TAG, '');

    expect(() => transform(html)).toThrow('<meta charset>');
  });

  it('fails with a clear message when the body is not closed', () => {
    const html = indexHtml.replace('</body>', '');

    expect(() => transform(html)).toThrow('</body>');
  });
});
