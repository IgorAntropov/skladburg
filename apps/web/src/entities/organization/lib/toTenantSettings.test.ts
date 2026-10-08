import type { MessageInitShape } from '@bufbuild/protobuf';
import type {
  MessageOverride,
  OrganizationSettings,
} from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  LocaleTermOverridesSchema,
  MessageOverrideSchema,
  OrganizationSettingsSchema,
  PluralFormsSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { toTenantSettings } from './toTenantSettings';

const ORGANIZATION_ID = 'f1000001-0000-4000-8000-000000000000';

const createText = (text: string): MessageOverride => create(MessageOverrideSchema, {
  value: { case: 'text', value: text },
});

const createPlural = (
  forms: MessageInitShape<typeof PluralFormsSchema>,
): MessageOverride => create(MessageOverrideSchema, {
  value: { case: 'plural', value: create(PluralFormsSchema, forms) },
});

const createSettings = (
  termOverrides: MessageInitShape<typeof LocaleTermOverridesSchema>[] = [],
): OrganizationSettings => create(OrganizationSettingsSchema, {
  availableLocales: ['ru', 'en'],
  brandName: 'Северный склад',
  defaultLocale: 'ru',
  organizationId: ORGANIZATION_ID,
  termOverrides: termOverrides.map(overrides => create(LocaleTermOverridesSchema, overrides)),
});

describe('toTenantSettings', () => {
  it('copies the organization identity and locales', () => {
    const tenantSettings = toTenantSettings(createSettings());

    expect(tenantSettings).toEqual({
      availableLocales: ['ru', 'en'],
      brandName: 'Северный склад',
      defaultLocale: 'ru',
      tenantId: ORGANIZATION_ID,
      termOverrides: {},
    });
  });

  it('turns text overrides into strings', () => {
    const tenantSettings = toTenantSettings(createSettings([
      { locale: 'ru', messages: { 'field.placeholder': createText('Скоро откроем'), 'field.title': createText('Площадка') } },
    ]));

    expect(tenantSettings.termOverrides).toEqual({
      ru: { 'field.placeholder': 'Скоро откроем', 'field.title': 'Площадка' },
    });
  });

  it('keeps only the plural categories that are set', () => {
    const tenantSettings = toTenantSettings(createSettings([
      {
        locale: 'ru',
        messages: { 'units.pallet': createPlural({ few: '{count} поддона', one: '{count} поддон', other: '{count} поддонов' }) },
      },
    ]));

    const pluralForms = tenantSettings.termOverrides.ru?.['units.pallet'];

    expect(pluralForms).toEqual({ few: '{count} поддона', one: '{count} поддон', other: '{count} поддонов' });
    expect(Object.keys(pluralForms ?? {})).toEqual(['one', 'few', 'other']);
  });

  it('keeps an empty-string category because it is set', () => {
    const tenantSettings = toTenantSettings(createSettings([
      { locale: 'ru', messages: { 'units.pallet': createPlural({ other: '{count} поддонов', zero: '' }) } },
    ]));

    expect(tenantSettings.termOverrides.ru?.['units.pallet']).toEqual({ other: '{count} поддонов', zero: '' });
  });

  it('collects overrides of several locales', () => {
    const tenantSettings = toTenantSettings(createSettings([
      { locale: 'ru', messages: { 'field.title': createText('Площадка') } },
      { locale: 'en', messages: { 'field.title': createText('Yard') } },
    ]));

    expect(tenantSettings.termOverrides).toEqual({
      en: { 'field.title': 'Yard' },
      ru: { 'field.title': 'Площадка' },
    });
  });

  it('merges a locale that appears twice and lets the later entry win per key', () => {
    const tenantSettings = toTenantSettings(createSettings([
      { locale: 'ru', messages: { 'field.placeholder': createText('Первое'), 'field.title': createText('Площадка') } },
      { locale: 'ru', messages: { 'field.placeholder': createText('Второе') } },
    ]));

    expect(tenantSettings.termOverrides).toEqual({
      ru: { 'field.placeholder': 'Второе', 'field.title': 'Площадка' },
    });
  });

  it('keeps a locale without messages as an empty map of overrides', () => {
    const tenantSettings = toTenantSettings(createSettings([{ locale: 'ru', messages: {} }]));

    expect(tenantSettings.termOverrides).toEqual({ ru: {} });
  });

  it('skips a message whose value is not set', () => {
    const tenantSettings = toTenantSettings(createSettings([
      { locale: 'ru', messages: { 'field.placeholder': create(MessageOverrideSchema), 'field.title': createText('Площадка') } },
    ]));

    expect(tenantSettings.termOverrides).toEqual({ ru: { 'field.title': 'Площадка' } });
  });

  it('does not touch the prototype for a hostile locale or key', () => {
    const tenantSettings = toTenantSettings(createSettings([
      { locale: '__proto__', messages: { polluted: createText('yes') } },
      { locale: 'ru', messages: { ['__proto__']: createText('yes') } },
    ]));

    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(Object.keys(tenantSettings.termOverrides)).toEqual(['__proto__', 'ru']);
  });
});
