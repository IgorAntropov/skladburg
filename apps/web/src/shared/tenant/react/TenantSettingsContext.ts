import { createContext } from 'react';

import type { TenantSettingsValue } from '../settings/tenantSettingsTypes';

export const TenantSettingsContext = createContext<TenantSettingsValue | undefined>(undefined);
