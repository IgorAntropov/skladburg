import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { FocusedObjectNote } from '@/shared/routing';

import { useIsDemoResetAvailable } from '../api/useIsDemoResetAvailable';
import { OrganizationCard } from './OrganizationCard';
import { ResetDemoButton } from './ResetDemoButton';
import { WarehouseList } from './WarehouseList';

interface WarehousePageProps {
  focus: ObjectRefValue | undefined;
}

export const WarehousePage = ({ focus }: WarehousePageProps): ReactElement => {
  const { t } = useI18n();
  const isDemoResetAvailable = useIsDemoResetAvailable();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t('section.warehouse.title')}</h1>
      {focus !== undefined && <FocusedObjectNote focus={focus} />}
      <OrganizationCard />
      <WarehouseList />
      <p className="text-base">{t('warehouse.placeholder')}</p>
      {isDemoResetAvailable && <ResetDemoButton />}
    </div>
  );
};
