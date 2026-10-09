import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { Tabs } from '@/shared/ui';

import { useWarehousesQuery } from '../api/useWarehousesQuery';
import { OrganizationCard } from './OrganizationCard';
import { WarehouseList } from './WarehouseList';

export const WarehouseLists = (): ReactElement => {
  const { t } = useI18n();
  const { data: warehouses } = useWarehousesQuery();

  const warehouseCount = warehouses?.length;

  return (
    <div className="flex flex-col gap-3">
      <OrganizationCard />
      <Tabs
        items={[
          {
            content: <WarehouseList />,
            count: warehouseCount,
            id: 'warehouses',
            label: t('hud.lists.warehouses'),
          },
        ]}
        label={t('hud.lists.label')}
      />
    </div>
  );
};
