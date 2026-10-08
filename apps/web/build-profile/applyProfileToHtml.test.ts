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

const TEMPLATE = '<html lang="%PROFILE_LANG%"><head><title>%PROFILE_TITLE%</title></head></html>';

describe('applyProfileToHtml', () => {
  it('substitutes the language and the title', () => {
    expect(applyProfileToHtml(TEMPLATE, createProfile('Северный склад'))).toBe(
      '<html lang="ru"><head><title>Северный склад</title></head></html>',
    );
  });

  it('uses the default locale of the tenant', () => {
    expect(applyProfileToHtml(TEMPLATE, createProfile('North Warehouse', 'en'))).toContain('lang="en"');
  });

  it('escapes HTML in the brand name', () => {
    const html = applyProfileToHtml(TEMPLATE, createProfile('Склад <"Север"> & \'Юг\''));

    expect(html).toContain('<title>Склад &lt;&quot;Север&quot;&gt; &amp; &#39;Юг&#39;</title>');
  });

  it('substitutes every occurrence of a placeholder', () => {
    const html = applyProfileToHtml(`${TEMPLATE}<meta content="%PROFILE_TITLE%">`, createProfile('Север'));

    expect(html).not.toContain('%PROFILE_TITLE%');
  });

  it('fails when the language placeholder is missing', () => {
    expect(() => applyProfileToHtml('<title>%PROFILE_TITLE%</title>', createProfile('Север'))).toThrow(/%PROFILE_LANG%/);
  });

  it('fails when the title placeholder is missing', () => {
    expect(() => applyProfileToHtml('<html lang="%PROFILE_LANG%"></html>', createProfile('Север'))).toThrow(/%PROFILE_TITLE%/);
  });
});
