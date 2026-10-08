import {
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { TenantSettingsValue } from '../settings/tenantSettingsTypes';

import { TenantSettingsProvider } from './TenantSettingsProvider';
import { useTenantSettings } from './useTenantSettings';

const tenantSettings: TenantSettingsValue = {
  availableLocales: ['ru'],
  brandName: 'Северный склад',
  defaultLocale: 'ru',
  tenantId: 'f2000001-0000-4000-8000-000000000000',
  termOverrides: {},
};

describe('useTenantSettings', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns the settings from the provider', () => {
    const { result } = renderHook(useTenantSettings, {
      wrapper: ({ children }) => <TenantSettingsProvider tenantSettings={tenantSettings}>{children}</TenantSettingsProvider>,
    });

    expect(result.current).toBe(tenantSettings);
  });

  it('throws outside of the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(useTenantSettings)).toThrow('useTenantSettings must be used inside TenantSettingsProvider');

    consoleError.mockRestore();
  });
});
