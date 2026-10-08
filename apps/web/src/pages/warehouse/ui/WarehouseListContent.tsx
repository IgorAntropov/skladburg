import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Card,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import { useWarehousesQuery } from '../api/useWarehousesQuery';
import {
  WAREHOUSE_ADDRESS_CLASS_NAME,
  WAREHOUSE_ADDRESS_SKELETON_CLASS_NAME,
  WAREHOUSE_NAME_CLASS_NAME,
  WAREHOUSE_NAME_SKELETON_CLASS_NAME,
} from './cardStyles';

const SKELETON_ROW_IDS = ['first', 'second', 'third'] as const;

const isListEmpty = (list: readonly unknown[]): boolean => list.length === 0;

export const WarehouseListContent = (): ReactElement => {
  const { t } = useI18n();
  const {
    data: warehouses,
    error,
    isFetching,
    refetch,
  } = useWarehousesQuery();

  const handleRetry = (): void => {
    console.log('> WarehouseListContent -> handleRetry:', { hasError: error !== null });
    void refetch();
  };

  const skeleton = (
    <div className="flex flex-col gap-3">
      {SKELETON_ROW_IDS.map(rowId => (
        <Card key={rowId}>
          <Skeleton className={WAREHOUSE_NAME_SKELETON_CLASS_NAME} />
          <Skeleton className={WAREHOUSE_ADDRESS_SKELETON_CLASS_NAME} />
        </Card>
      ))}
    </div>
  );

  return (
    <WidgetStates
      data={warehouses}
      empty={<p>{t('warehouse.warehouses.empty')}</p>}
      error={error}
      isEmpty={isListEmpty}
      isRetrying={isFetching}
      loadingLabel={t('warehouse.warehouses.loading')}
      onRetry={handleRetry}
      skeleton={skeleton}
    >
      {loadedWarehouses => (
        <ul className="flex flex-col gap-3">
          {loadedWarehouses.map((warehouse) => {
            const hasAddress = warehouse.address !== '';

            return (
              <li key={warehouse.id}>
                <Card>
                  <p className={WAREHOUSE_NAME_CLASS_NAME} translate="no">
                    {warehouse.name}
                  </p>
                  {hasAddress && (
                    <p className={WAREHOUSE_ADDRESS_CLASS_NAME} translate="no">
                      {t('warehouse.warehouses.address', { address: warehouse.address })}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetStates>
  );
};
