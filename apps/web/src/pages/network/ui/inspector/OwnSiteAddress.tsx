import type { ReactElement } from 'react';

import { useMemo } from 'react';

import { useWarehousesQuery } from '@/entities/warehouse';
import { useI18n } from '@/shared/i18n';

import { InspectorProperty } from './InspectorProperty';

interface OwnSiteAddressProps {
  warehouseId: string;
}

export const OwnSiteAddress = ({ warehouseId }: OwnSiteAddressProps): null | ReactElement => {
  const { t } = useI18n();
  const { data: warehouses } = useWarehousesQuery();

  const address = useMemo(
    () => warehouses?.find(warehouse => warehouse.id === warehouseId)?.address ?? '',
    [warehouseId, warehouses],
  );

  if (address === '') {
    return null;
  }

  return (
    <InspectorProperty label={t('network.inspector.address')}>
      <span translate="no">{address}</span>
    </InspectorProperty>
  );
};
