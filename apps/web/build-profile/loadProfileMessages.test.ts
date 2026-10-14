import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { BuildProfileValue } from './buildProfileTypes.ts';
import type { TempAppRootValue } from './createTempAppRoot.ts';

import { createTempAppRoot } from './createTempAppRoot.ts';
import { loadProfileMessages } from './loadProfileMessages.ts';

const CATALOG_SOURCE = [
  'export const catalog = {',
  '  \'app.greeting\': \'Привет, {name}\',',
  '  \'app.plural\': { few: \'{count} штуки\', many: \'{count} штук\', one: \'{count} штука\', other: \'{count} штуки\' },',
  '  \'app.productName\': \'Тридок\',',
  '  \'app.tagline\': \'Поставки от склада до склада\',',
  '};',
  '',
].join('\n');

const cleanups: TempAppRootValue[] = [];

const prepare = (): string => {
  const tempAppRoot = createTempAppRoot({ catalogSources: { ru: CATALOG_SOURCE } });

  cleanups.push(tempAppRoot);

  return tempAppRoot.appRoot;
};

const createProfile = (termOverrides: BuildProfileValue['defaultTenant']['termOverrides'] = {}): BuildProfileValue => ({
  bundledLocales: ['ru'],
  defaultTenant: {
    availableLocales: ['ru'],
    brandName: 'Заказчик 1',
    defaultLocale: 'ru',
    tenantId: 'f1000001-0000-4000-8000-000000000000',
    termOverrides,
  },
});

describe('loadProfileMessages', () => {
  afterEach(() => {
    for (const tempAppRoot of cleanups.splice(0)) {
      tempAppRoot.remove();
    }
  });

  it('reads the requested messages from the catalog of the default locale', async () => {
    const messages = await loadProfileMessages({
      appRoot: prepare(),
      keys: ['app.productName', 'app.tagline'],
      profile: createProfile(),
    });

    expect(messages).toEqual({ 'app.productName': 'Тридок', 'app.tagline': 'Поставки от склада до склада' });
  });

  it('lets the term overrides of the profile replace a message', async () => {
    const messages = await loadProfileMessages({
      appRoot: prepare(),
      keys: ['app.productName'],
      profile: createProfile({ ru: { 'app.productName': 'Склад Севера' } }),
    });

    expect(messages['app.productName']).toBe('Склад Севера');
  });

  it('ignores overrides of another locale', async () => {
    const messages = await loadProfileMessages({
      appRoot: prepare(),
      keys: ['app.productName'],
      profile: createProfile({ en: { 'app.productName': 'North' } }),
    });

    expect(messages['app.productName']).toBe('Тридок');
  });

  it('ignores an override with different placeholders', async () => {
    const messages = await loadProfileMessages({
      appRoot: prepare(),
      keys: ['app.greeting'],
      profile: createProfile({ ru: { 'app.greeting': 'Здравствуйте, {user}' } }),
    });

    expect(messages['app.greeting']).toBe('Привет, {name}');
  });

  it('ignores an override given as plural forms for a text message', async () => {
    const messages = await loadProfileMessages({
      appRoot: prepare(),
      keys: ['app.productName'],
      profile: createProfile({ ru: { 'app.productName': { other: 'Склад' } } }),
    });

    expect(messages['app.productName']).toBe('Тридок');
  });

  it('fails with the name of a missing key', async () => {
    await expect(
      loadProfileMessages({ appRoot: prepare(), keys: ['app.productName', 'app.absent'], profile: createProfile() }),
    ).rejects.toThrow(/"app\.absent"/);
  });

  it('fails with the name of a key whose message is not a string', async () => {
    await expect(
      loadProfileMessages({ appRoot: prepare(), keys: ['app.plural'], profile: createProfile() }),
    ).rejects.toThrow(/"app\.plural"/);
  });
});
