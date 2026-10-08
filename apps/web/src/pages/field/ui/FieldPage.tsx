import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { useTenantSettings } from '@/shared/tenant';

import { useIsDemoResetAvailable } from '../api/useIsDemoResetAvailable';
import { OrganizationCard } from './OrganizationCard';
import { ResetDemoButton } from './ResetDemoButton';
import { WarehouseList } from './WarehouseList';

export const FieldPage = (): ReactElement => {
  const { t } = useI18n();
  const { brandName } = useTenantSettings();
  const isDemoResetAvailable = useIsDemoResetAvailable();

  return (
    <main className="min-h-dvh bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight" translate="no">
            {brandName}
          </h1>
        </header>
        <OrganizationCard />
        <WarehouseList />
        <p className="text-base">{t('field.placeholder')}</p>
        {isDemoResetAvailable && <ResetDemoButton />}
      </div>
    </main>
  );
};
