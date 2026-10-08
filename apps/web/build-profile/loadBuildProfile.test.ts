import { join } from 'node:path';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TempAppRootValue } from './createTempAppRoot.ts';

import {
  createTempAppRoot,
  createValidProfile,
} from './createTempAppRoot.ts';
import { loadBuildProfile } from './loadBuildProfile.ts';

const REAL_APP_ROOT = join(import.meta.dirname, '..');

const cleanups: TempAppRootValue[] = [];

const prepare = (...args: Parameters<typeof createTempAppRoot>): string => {
  const tempAppRoot = createTempAppRoot(...args);

  cleanups.push(tempAppRoot);

  return tempAppRoot.appRoot;
};

describe('loadBuildProfile', () => {
  afterEach(() => {
    for (const tempAppRoot of cleanups.splice(0)) {
      tempAppRoot.remove();
    }
  });

  it('loads a valid profile', () => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { sample: createValidProfile() } });

    const profile = loadBuildProfile({ appRoot, profileName: 'sample' });

    expect(profile.bundledLocales).toEqual(['ru', 'en']);
    expect(profile.defaultTenant.tenantId).toBe('f1000001-0000-4000-8000-000000000000');
    expect(profile.defaultTenant.brandName).toBe('Северный склад');
  });

  it('loads the default profile of the application', () => {
    const profile = loadBuildProfile({ appRoot: REAL_APP_ROOT, profileName: 'default' });

    expect(profile.defaultTenant.tenantId).toBe('10000001-0000-4000-8000-000000000000');
    expect(profile.bundledLocales).toEqual(['ru']);
    expect(profile.defaultTenant.defaultLocale).toBe('ru');
    expect(profile.defaultTenant.availableLocales).toEqual(['ru']);
  });

  it('explains that the tenant identifier must be a UUID', () => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { sample: createValidProfile({ tenantId: 'north-warehouse' }) } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(
      'Build profile "sample": defaultTenant.tenantId must be a UUID in the lowercase 8-4-4-4-12 form',
    );
  });

  it('accepts term overrides with strings and plural forms', () => {
    const appRoot = prepare({
      catalogs: ['ru', 'en'],
      profiles: {
        sample: createValidProfile({
          termOverrides: { ru: { 'field.placeholder': 'Скоро', 'units.pallet': { one: '{count} поддон', other: '{count} поддона' } } },
        }),
      },
    });

    const profile = loadBuildProfile({ appRoot, profileName: 'sample' });

    expect(profile.defaultTenant.termOverrides.ru?.['field.placeholder']).toBe('Скоро');
  });

  it('lists available profiles when the requested one is missing', () => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { alpha: createValidProfile(), beta: createValidProfile() } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'gamma' })).toThrow(
      /Build profile "gamma" not found.*Available profiles: alpha, beta/,
    );
  });

  it('reports that no profiles exist at all', () => {
    const appRoot = prepare();

    expect(() => loadBuildProfile({ appRoot, profileName: 'gamma' })).toThrow(/Available profiles: none/);
  });

  it.each(['', '../secret', 'a/b', '.hidden', 'name with space'])('rejects the unsafe profile name "%s"', (profileName) => {
    const appRoot = prepare();

    expect(() => loadBuildProfile({ appRoot, profileName })).toThrow(/is invalid/);
  });

  it('rejects a profile that is not valid JSON', () => {
    const appRoot = prepare({ profiles: { broken: '{ "bundledLocales": ' } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'broken' })).toThrow(/Build profile "broken".*is not valid JSON/);
  });

  it.each([
    ['array', '[]'],
    ['null', 'null'],
    ['string', '"ru"'],
  ])('rejects a profile that is %s instead of an object', (_label, text) => {
    const appRoot = prepare({ profiles: { shape: text } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'shape' })).toThrow(/must be a JSON object/);
  });

  it.each([
    ['missing', undefined],
    ['empty', []],
    ['not an array', 'ru'],
    ['with a non-string item', ['ru', 1]],
    ['with an invalid code', ['ru', 'не-язык']],
    ['with an invalid language tag', ['ru', 'ru-x']],
    ['with an upper-case code', ['RU']],
    ['with duplicates', ['ru', 'ru']],
  ])('rejects bundledLocales that are %s', (_label, bundledLocales) => {
    const appRoot = prepare({ catalogs: ['ru'], profiles: { sample: createValidProfile({}, { bundledLocales }) } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(/bundledLocales/);
  });

  it('names the field, the code and the canonical form for a non-canonical locale code', () => {
    const profile = createValidProfile({ availableLocales: ['ru'] }, { bundledLocales: ['ru-ru'] });
    const appRoot = prepare({ catalogs: ['ru'], profiles: { sample: profile } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(
      /bundledLocales contains the locale code "ru-ru" in a non-canonical form, use "ru-RU"/,
    );
  });

  it('names the field and the code for an invalid locale tag', () => {
    const appRoot = prepare({ catalogs: ['ru'], profiles: { sample: createValidProfile({}, { bundledLocales: ['ru-x'] }) } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(
      /bundledLocales contains an invalid locale code "ru-x"/,
    );
  });

  it.each([
    ['availableLocales', { availableLocales: ['ru', 'EN'] }, /defaultTenant\.availableLocales contains the locale code "EN".*use "en"/],
    ['availableLocales', { availableLocales: ['ru', 'ru-x'] }, /defaultTenant\.availableLocales contains an invalid locale code "ru-x"/],
    ['defaultLocale', { defaultLocale: 'RU' }, /defaultTenant\.defaultLocale contains the locale code "RU".*use "ru"/],
    ['defaultLocale', { defaultLocale: 'ru-x' }, /defaultTenant\.defaultLocale contains an invalid locale code "ru-x"/],
    ['termOverrides', { termOverrides: { RU: {} } }, /defaultTenant\.termOverrides contains the locale code "RU".*use "ru"/],
    ['termOverrides', { termOverrides: { 'ru-x': {} } }, /defaultTenant\.termOverrides contains an invalid locale code "ru-x"/],
  ])('rejects a malformed locale code in defaultTenant.%s', (_field, tenantPatch, message) => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { sample: createValidProfile(tenantPatch) } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(message);
  });

  it('rejects a catalog file whose name differs from the locale code by case', () => {
    const profile = createValidProfile({ availableLocales: ['ru-RU'], defaultLocale: 'ru-RU' }, { bundledLocales: ['ru-RU'] });
    const appRoot = prepare({ catalogs: ['ru-ru'], profiles: { sample: profile } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(/catalog for locale "ru-RU" not found/);
  });

  it('rejects a locale without a catalog file', () => {
    const appRoot = prepare({ catalogs: ['ru'], profiles: { sample: createValidProfile() } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(/catalog for locale "en" not found/);
  });

  it('rejects a profile without defaultTenant', () => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { sample: { bundledLocales: ['ru'] } } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(/defaultTenant must be an object/);
  });

  it.each([
    ['brandName', undefined],
    ['brandName', ''],
    ['brandName', 7],
    ['tenantId', undefined],
    ['tenantId', ''],
    ['tenantId', 'north-warehouse'],
    ['tenantId', 'F1000001-0000-4000-8000-000000000000'],
    ['tenantId', 'f1000001-0000-4000-8000-00000000000'],
    ['tenantId', 'f1000001000040008000000000000000'],
    ['tenantId', 'g1000001-0000-4000-8000-000000000000'],
    ['tenantId', 7],
    ['defaultLocale', undefined],
    ['availableLocales', undefined],
    ['availableLocales', []],
    ['availableLocales', ['ru', 5]],
    ['termOverrides', undefined],
    ['termOverrides', []],
    ['termOverrides', { ru: 'text' }],
    ['termOverrides', { ru: { key: 5 } }],
    ['termOverrides', { ru: { key: { one: 5 } } }],
  ])('rejects defaultTenant.%s equal to %j', (field, value) => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { sample: createValidProfile({ [field]: value }) } });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(new RegExp(`defaultTenant\\.${field}`));
  });

  it('rejects a default locale missing from availableLocales', () => {
    const appRoot = prepare({
      catalogs: ['ru', 'en'],
      profiles: { sample: createValidProfile({ availableLocales: ['en'], defaultLocale: 'ru' }) },
    });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(/"ru" is not in defaultTenant.availableLocales/);
  });

  it('rejects a default locale missing from bundledLocales', () => {
    const appRoot = prepare({
      catalogs: ['ru', 'en'],
      profiles: { sample: createValidProfile({ defaultLocale: 'en' }, { bundledLocales: ['ru'] }) },
    });

    expect(() => loadBuildProfile({ appRoot, profileName: 'sample' })).toThrow(/"en" is not in bundledLocales/);
  });
});
