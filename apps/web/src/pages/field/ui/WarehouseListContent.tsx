import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

import { useWarehousesQuery } from '../api/useWarehousesQuery';
import {
  CARD_CLASS_NAME,
  CARD_SKELETON_CLASS_NAME,
  createSkeletonLineClassName,
  WAREHOUSE_ADDRESS_CLASS_NAME,
  WAREHOUSE_NAME_CLASS_NAME,
} from './cardStyles';
import { QueryErrorNotice } from './QueryErrorNotice';

const SKELETON_ROW_IDS = ['first', 'second', 'third'] as const;

export const WarehouseListContent = (): ReactElement => {
  const { t } = useI18n();
  const {
    data: warehouses,
    error,
    isError,
    refetch,
  } = useWarehousesQuery();

  const isFailed = warehouses === undefined && isError;

  const handleRetry = (): void => {
    console.log('> WarehouseListContent -> handleRetry:', { isFailed });
    void refetch();
  };

  if (warehouses?.length === 0) {
    return <p>{t('field.warehouses.empty')}</p>;
  }

  if (warehouses !== undefined) {
    return (
      <ul className="flex flex-col gap-3">
        {warehouses.map((warehouse) => {
          const hasAddress = warehouse.address !== '';

          return (
            <li className={CARD_CLASS_NAME} key={warehouse.id}>
              <p className={WAREHOUSE_NAME_CLASS_NAME} translate="no">
                {warehouse.name}
              </p>
              {hasAddress && (
                <p className={WAREHOUSE_ADDRESS_CLASS_NAME} translate="no">
                  {t('field.warehouses.address', { address: warehouse.address })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (isFailed) {
    return <QueryErrorNotice error={error} onRetry={handleRetry} />;
  }

  return (
    <ul aria-busy="true" aria-label={t('field.warehouses.loading')} className="flex flex-col gap-3">
      {SKELETON_ROW_IDS.map(rowId => (
        <li className={CARD_SKELETON_CLASS_NAME} key={rowId}>
          <p aria-hidden="true" className={createSkeletonLineClassName(WAREHOUSE_NAME_CLASS_NAME)} />
          <p aria-hidden="true" className={createSkeletonLineClassName(WAREHOUSE_ADDRESS_CLASS_NAME)} />
        </li>
      ))}
    </ul>
  );
};
