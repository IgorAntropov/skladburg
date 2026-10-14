import {
  describe,
  expect,
  it,
} from 'vitest';

import type { BuildProfileValue } from './buildProfileTypes.ts';

import { applyProfileToHtml } from './applyProfileToHtml.ts';

const createProfile = (brandName: string, defaultLocale = 'ru'): BuildProfileValue => ({
  bundledLocales: [defaultLocale],
  defaultTenant: {
    availableLocales: [defaultLocale],
    brandName,
    defaultLocale,
    tenantId: 'f1000001-0000-4000-8000-000000000000',
    termOverrides: {},
  },
});

const TEMPLATE = [
  '<html lang="%PROFILE_LANG%"><head>',
  '<title>%PROFILE_TITLE%</title>',
  '<meta name="app-name" content="%PROFILE_APP_NAME%">',
  '</head></html>',
].join('');

const APP_NAME = 'Тридок';

describe('applyProfileToHtml', () => {
  it('substitutes the language, the title and the application name', () => {
    expect(applyProfileToHtml(TEMPLATE, createProfile('Северный склад'), APP_NAME)).toBe(
      '<html lang="ru"><head><title>Северный склад</title><meta name="app-name" content="Тридок"></head></html>',
    );
  });

  it('uses the default locale of the tenant', () => {
    expect(applyProfileToHtml(TEMPLATE, createProfile('North Warehouse', 'en'), APP_NAME)).toContain('lang="en"');
  });

  it('escapes HTML in the brand name', () => {
    const html = applyProfileToHtml(TEMPLATE, createProfile('Склад <"Север"> & \'Юг\''), APP_NAME);

    expect(html).toContain('<title>Склад &lt;&quot;Север&quot;&gt; &amp; &#39;Юг&#39;</title>');
  });

  it('substitutes every occurrence of a placeholder', () => {
    const html = applyProfileToHtml(`${TEMPLATE}<meta content="%PROFILE_TITLE%">`, createProfile('Север'), APP_NAME);

    expect(html).not.toContain('%PROFILE_TITLE%');
  });

  it('fails when the language placeholder is missing', () => {
    const html = '<title>%PROFILE_TITLE%</title><i>%PROFILE_APP_NAME%</i>';

    expect(() => applyProfileToHtml(html, createProfile('Север'), APP_NAME)).toThrow(/%PROFILE_LANG%/);
  });

  it('fails when the title placeholder is missing', () => {
    const html = '<html lang="%PROFILE_LANG%">%PROFILE_APP_NAME%</html>';

    expect(() => applyProfileToHtml(html, createProfile('Север'), APP_NAME)).toThrow(/%PROFILE_TITLE%/);
  });

  it('fails when the application name placeholder is missing', () => {
    const html = '<html lang="%PROFILE_LANG%"><title>%PROFILE_TITLE%</title></html>';

    expect(() => applyProfileToHtml(html, createProfile('Север'), APP_NAME)).toThrow(/%PROFILE_APP_NAME%/);
  });

  it('escapes HTML in the application name', () => {
    const html = applyProfileToHtml(TEMPLATE, createProfile('Север'), 'Три<док> & "Ко"');

    expect(html).toContain('content="Три&lt;док&gt; &amp; &quot;Ко&quot;"');
  });
});
