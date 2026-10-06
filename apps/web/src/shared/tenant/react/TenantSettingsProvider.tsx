import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { TenantSettingsValue } from '../settings/tenantSettingsTypes';

import { TenantSettingsContext } from './TenantSettingsContext';

interface TenantSettingsProviderProps {
  children: ReactNode;
  tenantSettings: TenantSettingsValue;
}

export const TenantSettingsProvider = ({ children, tenantSettings }: TenantSettingsProviderProps): ReactElement => {
  return <TenantSettingsContext value={tenantSettings}>{children}</TenantSettingsContext>;
};
