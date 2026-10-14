import {
  describe,
  expect,
  it,
} from 'vitest';

import { createBootFallbackMarkup } from './createBootFallbackMarkup.ts';

describe('createBootFallbackMarkup', () => {
  it('builds a hidden block with the text and a reload button that tests can find', () => {
    const markup = createBootFallbackMarkup({
      elementId: 'boot-fallback',
      messages: { message: 'Не загрузилось', reload: 'Обновить' },
    });

    expect(markup).toBe([
      '<div id="boot-fallback" hidden data-testid="boot-fallback">',
      '<p>Не загрузилось</p>',
      '<button type="button" data-testid="boot-fallback-reload">Обновить</button>',
      '</div>',
    ].join(''));
  });

  it('escapes the texts and the id', () => {
    const markup = createBootFallbackMarkup({
      elementId: 'a"b',
      messages: { message: '<b>"&\'', reload: '</button><script>' },
    });

    expect(markup).toContain('id="a&quot;b"');
    expect(markup).toContain('<p>&lt;b&gt;&quot;&amp;&#39;</p>');
    expect(markup).toContain('&lt;/button&gt;&lt;script&gt;');
    expect(markup).not.toContain('<script>');
    expect(markup).not.toContain('<b>');
  });
});
