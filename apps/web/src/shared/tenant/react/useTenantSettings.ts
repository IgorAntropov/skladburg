import { useContext } from 'react';

import type { TenantSettingsValue } from '../settings/tenantSettingsTypes';

import { TenantSettingsContext } from './TenantSettingsContext';

export const useTenantSettings = (): TenantSettingsValue => {
  const tenantSettings = useContext(TenantSettingsContext);

  if (tenantSettings === undefined) {
    throw new Error('useTenantSettings must be used inside TenantSettingsProvider');
  }

  return tenantSettings;
};
