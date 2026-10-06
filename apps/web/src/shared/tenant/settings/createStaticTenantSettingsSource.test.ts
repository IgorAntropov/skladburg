import {
  describe,
  expect,
  it,
} from 'vitest';

import type { TenantSettingsValue } from './tenantSettingsTypes';

import { createStaticTenantSettingsSource } from './createStaticTenantSettingsSource';

const northWarehouse: TenantSettingsValue = {
  availableLocales: ['ru'],
  brandName: 'Северный склад',
  defaultLocale: 'ru',
  tenantId: 'north-warehouse',
  termOverrides: {},
};

const southLogistics: TenantSettingsValue = {
  availableLocales: ['ru', 'en'],
  brandName: 'Южная логистика',
  defaultLocale: 'en',
  tenantId: 'south-logistics',
  termOverrides: { en: { 'field.placeholder': 'Opening soon' } },
};

describe('createStaticTenantSettingsSource', () => {
  it('returns the settings of the requested tenant', async () => {
    const source = createStaticTenantSettingsSource([northWarehouse, southLogistics]);

    await expect(source.getTenantSettings('south-logistics')).resolves.toEqual(southLogistics);
    await expect(source.getTenantSettings('north-warehouse')).resolves.toEqual(northWarehouse);
  });

  it('rejects an unknown tenant with a readable error', async () => {
    const source = createStaticTenantSettingsSource([northWarehouse]);

    await expect(source.getTenantSettings('unknown-tenant')).rejects.toThrow('Tenant settings not found for tenantId "unknown-tenant"');
  });

  it('rejects every tenant when the source is empty', async () => {
    const source = createStaticTenantSettingsSource([]);

    await expect(source.getTenantSettings('north-warehouse')).rejects.toBeInstanceOf(Error);
  });
});
