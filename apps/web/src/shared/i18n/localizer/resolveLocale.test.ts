import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveLocale } from './resolveLocale';

const tenantOf = (defaultLocale: string, availableLocales: string[]): {
  availableLocales: string[];
  defaultLocale: string;
  termOverrides: Record<string, never>;
} => ({ availableLocales, defaultLocale, termOverrides: {} });

describe('resolveLocale', () => {
  it('returns the requested locale when the tenant allows it and the bundle has it', () => {
    const locale = resolveLocale({
      bundledLocales: ['ru', 'en'],
      requestedLocale: 'en',
      tenant: tenantOf('ru', ['ru', 'en']),
    });

    expect(locale).toBe('en');
  });

  it('skips a requested locale that the bundle does not have', () => {
    const locale = resolveLocale({
      bundledLocales: ['ru'],
      requestedLocale: 'en',
      tenant: tenantOf('ru', ['ru', 'en']),
    });

    expect(locale).toBe('ru');
  });

  it('skips a requested locale that the tenant does not allow', () => {
    const locale = resolveLocale({
      bundledLocales: ['ru', 'en'],
      requestedLocale: 'en',
      tenant: tenantOf('ru', ['ru']),
    });

    expect(locale).toBe('ru');
  });

  it('uses the tenant default locale when nothing is requested', () => {
    const locale = resolveLocale({
      bundledLocales: ['ru', 'en'],
      requestedLocale: undefined,
      tenant: tenantOf('en', ['ru', 'en']),
    });

    expect(locale).toBe('en');
  });

  it('uses the first tenant locale from the bundle when the default is not bundled', () => {
    const locale = resolveLocale({
      bundledLocales: ['ru', 'de'],
      requestedLocale: undefined,
      tenant: tenantOf('en', ['en', 'de', 'ru']),
    });

    expect(locale).toBe('de');
  });

  it('uses the first bundled locale when the tenant shares none with the bundle', () => {
    const locale = resolveLocale({
      bundledLocales: ['ru', 'de'],
      requestedLocale: undefined,
      tenant: tenantOf('en', ['en']),
    });

    expect(locale).toBe('ru');
  });

  it('throws when nothing is bundled', () => {
    expect(() => resolveLocale({
      bundledLocales: [],
      requestedLocale: undefined,
      tenant: tenantOf('en', ['en']),
    })).toThrow('no locales are bundled');
  });
});
