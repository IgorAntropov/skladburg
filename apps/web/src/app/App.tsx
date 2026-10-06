import type { ReactElement } from 'react';

import type { ILocalizer } from '@/shared/i18n';
import type { TenantSettingsValue } from '@/shared/tenant';

import { LocalizerProvider } from '@/shared/i18n';
import { TenantSettingsProvider } from '@/shared/tenant';

import { AppShell } from './shell/AppShell';
import './styles/index.css';

interface AppProps {
  localizer: ILocalizer;
  tenantSettings: TenantSettingsValue;
}

export const App = ({ localizer, tenantSettings }: AppProps): ReactElement => {
  return (
    <LocalizerProvider localizer={localizer}>
      <TenantSettingsProvider tenantSettings={tenantSettings}>
        <AppShell />
      </TenantSettingsProvider>
    </LocalizerProvider>
  );
};
