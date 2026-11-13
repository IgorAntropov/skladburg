import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';

import { AssistantPortrait } from '@/entities/assistant';
import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import { useWarehousesQuery } from '@/entities/warehouse';
import { useI18n } from '@/shared/i18n';
import {
  Card,
  EmptyState,
  Skeleton,
  TextLink,
  WidgetStates,
} from '@/shared/ui';

import { warehouseWorkspaceLauncherMessages } from '../i18n/workspaceLauncherRu';
import {
  WAREHOUSE_ADDRESS_CLASS_NAME,
  WAREHOUSE_ADDRESS_SKELETON_CLASS_NAME,
  WAREHOUSE_CARD_CLASS_NAME,
  WAREHOUSE_NAME_CLASS_NAME,
  WAREHOUSE_NAME_SKELETON_CLASS_NAME,
} from './cardStyles';

const SKELETON_ROW_IDS = ['first', 'second', 'third'] as const;

const isListEmpty = (list: readonly unknown[]): boolean => list.length === 0;

export const WarehouseListContent = (): ReactElement => {
  const { createSectionTranslator, t } = useI18n();
  const workText = createSectionTranslator(warehouseWorkspaceLauncherMessages);
  const session = useSessionQuery();
  const permissions = session.data?.permissions;
  const {
    data: warehouses,
    error,
    isFetching,
    refetch,
  } = useWarehousesQuery();

  const ownWarehouses = permissions === undefined
    ? undefined
    : warehouses?.filter(warehouse =>
        isPermissionGranted(permissions, PermissionCode.WAREHOUSE_VIEW, { kind: 'warehouse', warehouseId: warehouse.id }));

  const handleRetry = (): void => {
    console.log('> WarehouseListContent -> handleRetry:', { hasError: error !== null });
    if (session.error !== null) {
      void session.refetch();
    }
    void refetch();
  };

  const skeleton = (
    <div className="flex flex-col gap-3">
      {SKELETON_ROW_IDS.map(rowId => (
        <Card className={WAREHOUSE_CARD_CLASS_NAME} key={rowId}>
          <Skeleton className={WAREHOUSE_NAME_SKELETON_CLASS_NAME} />
          <Skeleton className={WAREHOUSE_ADDRESS_SKELETON_CLASS_NAME} />
        </Card>
      ))}
    </div>
  );

  return (
    <WidgetStates
      data={ownWarehouses}
      empty={<EmptyState media={<AssistantPortrait size="sm" />} text={t('warehouse.warehouses.empty')} />}
      error={error ?? session.error}
      isEmpty={isListEmpty}
      isRetrying={isFetching || session.isFetching}
      loadingLabel={t('warehouse.warehouses.loading')}
      onRetry={handleRetry}
      skeleton={skeleton}
    >
      {loadedWarehouses => (
        <ul className="flex flex-col gap-3">
          {loadedWarehouses.map((warehouse) => {
            const hasAddress = warehouse.address !== '';

            return (
              <li data-testid="warehouse-list-item" key={warehouse.id}>
                <Card className={WAREHOUSE_CARD_CLASS_NAME}>
                  <p className={WAREHOUSE_NAME_CLASS_NAME} translate="no">
                    {warehouse.name}
                  </p>
                  {hasAddress && (
                    <p className={WAREHOUSE_ADDRESS_CLASS_NAME} translate="no">
                      {t('warehouse.warehouses.address', { address: warehouse.address })}
                    </p>
                  )}
                  <TextLink
                    data-testid="warehouse-workspace-open"
                    isFocusRequested
                    size="sm"
                    to={{ kind: 'object', object: { id: warehouse.id, type: 'warehouse' } }}
                  >
                    {workText('warehouseWork.open')}
                  </TextLink>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetStates>
  );
};
