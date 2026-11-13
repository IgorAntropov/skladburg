import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';
import {
  ClipboardList,
  Package,
} from 'lucide-react';
import { useState } from 'react';

import type { ObjectRefValue } from '@/shared/routing';
import type { TabsItemValue } from '@/shared/ui';

import { useCan } from '@/entities/session';
import { isReadAccessDenied } from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  ChunkLoadNotice,
  EmptyState,
  Skeleton,
  SkeletonGroup,
  Tabs,
  TextLink,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import { useWarehouseWorkspace } from '../../api/useWarehouseWorkspace';
import { warehouseWorkSection } from '../../i18n/workspaceSection';
import { readCells } from './warehouseFormatting';
import {
  WarehouseAddresses,
  WarehouseMovements,
  WarehouseStock,
} from './WarehouseInventory';
import { WarehousePicking } from './WarehousePicking';
import { WarehouseReceiving } from './WarehouseReceiving';

interface WarehouseQueryProps<TData> {
  children: (data: TData) => ReactNode;
  empty: string;
  isEmpty?: ((data: TData) => boolean) | undefined;
  query: UseQueryResult<TData>;
  t: WarehouseWorkTranslate;
}

interface WarehouseWorkspaceProps {
  focus: ObjectRefValue | undefined;
  warehouse: Warehouse;
}

const NO_CHANGE = (): void => undefined;
const isEmptyList = (items: readonly unknown[]): boolean => items.length === 0;

const WarehouseSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-2">
    <Skeleton className="h-11 w-2/3" />
    <Skeleton className="h-20 w-full" />
  </div>
);

function WarehouseQuery<TData>({ children, empty, isEmpty, query, t }: WarehouseQueryProps<TData>): ReactElement {
  const { t: baseText } = useI18n();

  const handleRetry = (): void => {
    console.log('> WarehouseQuery -> handleRetry:', {});
    void query.refetch();
  };

  if (isReadAccessDenied(query.error)) {
    return <EmptyState icon={Package} text={t('warehouseWork.noAccess')} />;
  }

  return (
    <WidgetStates
      data={query.data}
      empty={<EmptyState icon={Package} text={empty} />}
      error={query.error}
      isEmpty={isEmpty}
      isRetrying={query.isFetching}
      loadingLabel={baseText('routing.section.loading')}
      onRetry={handleRetry}
      skeleton={<WarehouseSkeleton />}
    >
      {children}
    </WidgetStates>
  );
}

const WarehouseWorkspaceContent = ({ focus, t, warehouse }: WarehouseWorkspaceProps & { t: WarehouseWorkTranslate }): ReactElement => {
  const { t: baseText } = useI18n();
  const workspace = useWarehouseWorkspace(warehouse.id);
  const canViewDeals = useCan(PermissionCode.DEAL_VIEW, { kind: 'organization' });
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();
  const hasEditor = editingTaskId !== undefined && workspace.receiving.data?.some(task => task.id === editingTaskId
    && task.status === ReceivingTaskStatus.IN_PROGRESS) === true;
  const cells = readCells(workspace.topology.data);
  const productNames = new Map(workspace.receiving.data?.flatMap(task =>
    task.orderLines.map(({ productId, productName }) => [productId, productName] as const)));
  const tabs: TabsItemValue[] = [];

  if (workspace.isSessionPending) {
    return <SkeletonGroup isFilled label={baseText('routing.section.loading')}><WarehouseSkeleton /></SkeletonGroup>;
  }

  if (workspace.canViewTasks) {
    const count = workspace.picking.data?.filter(task =>
      task.status !== PickingTaskStatus.CANCELLED && task.status !== PickingTaskStatus.SHIPPED).length;
    const receivingCount = workspace.receiving.data?.filter(task => task.status !== ReceivingTaskStatus.RECONCILED
      || task.receivedUnits.some(unit => unit.putAwayCellId === undefined)).length;
    const hasNoTasks = workspace.picking.data?.length === 0 && workspace.receiving.data?.length === 0;

    tabs.push({
      content: hasNoTasks
        ? <EmptyState icon={ClipboardList} text={t('warehouseWork.emptyTasks')} />
        : (
            <div className="flex flex-col gap-3" data-testid="warehouse-tasks">
              <WarehouseQuery empty={t('warehouseWork.emptyTasks')} query={workspace.picking} t={t}>
                {tasks => tasks.map(task => (
                  <WarehousePicking canViewDeals={canViewDeals} cells={cells} key={task.id} onChanged={NO_CHANGE} t={t} task={task} />
                ))}
              </WarehouseQuery>
              <WarehouseQuery empty={t('warehouseWork.emptyTasks')} query={workspace.receiving} t={t}>
                {tasks => tasks.map(task => (
                  <WarehouseReceiving
                    canViewDeals={canViewDeals}
                    cells={cells}
                    editingTaskId={hasEditor ? editingTaskId : undefined}
                    key={task.id}
                    onChanged={NO_CHANGE}
                    onEditingChange={setEditingTaskId}
                    t={t}
                    task={task}
                  />
                ))}
              </WarehouseQuery>
            </div>
          ),
      count: count === undefined || receivingCount === undefined ? undefined : count + receivingCount,
      id: 'tasks',
      label: t('warehouseWork.tasks'),
    });
  }

  if (workspace.canViewTopology) {
    tabs.push({
      content: (
        <WarehouseQuery
          empty={t('warehouseWork.emptyAddresses')}
          isEmpty={topology => readCells(topology).size === 0}
          query={workspace.topology}
          t={t}
        >
          {() => <WarehouseAddresses cells={cells} focus={focus} t={t} />}
        </WarehouseQuery>
      ),
      id: 'addresses',
      label: t('warehouseWork.addresses'),
    });
  }

  if (workspace.canViewInventory) {
    tabs.push(
      {
        content: (
          <WarehouseQuery empty={t('warehouseWork.emptyStock')} isEmpty={isEmptyList} query={workspace.balances} t={t}>
            {balances => <WarehouseStock balances={balances} cells={cells} focus={focus} productNames={productNames} t={t} />}
          </WarehouseQuery>
        ),
        id: 'stock',
        label: t('warehouseWork.stock'),
      },
      {
        content: (
          <WarehouseQuery empty={t('warehouseWork.emptyMovements')} isEmpty={isEmptyList} query={workspace.movements} t={t}>
            {movements => (
              <WarehouseMovements
                balances={workspace.balances.data}
                canViewDeals={canViewDeals}
                cells={cells}
                movements={movements}
                productNames={productNames}
                t={t}
                warehouse={warehouse}
              />
            )}
          </WarehouseQuery>
        ),
        id: 'movements',
        label: t('warehouseWork.movements'),
      },
    );
  }

  const isCell = focus?.type === 'cell';
  const isUnit = focus?.type === 'handling_unit';
  const defaultTabId = isUnit || (isCell && workspace.canViewInventory) ? 'stock' : isCell ? 'addresses' : undefined;
  const cellLabel = isCell ? cells.get(focus.id) : undefined;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2" data-testid="warehouse-workspace">
      <header className="flex flex-col items-start gap-1">
        <TextLink size="sm" to={{ kind: 'section', section: 'warehouse' }}>{t('warehouseWork.back')}</TextLink>
        <h2 className="text-xl font-semibold wrap-anywhere" translate="no">{warehouse.name}</h2>
        {cellLabel !== undefined && (
          <p className="text-sm text-on-panel-muted">
            {t('warehouseWork.cell')}
            {' '}
            {cellLabel}
          </p>
        )}
        {(isCell || isUnit) && (
          <TextLink size="sm" to={{ kind: 'object', object: { id: warehouse.id, type: 'warehouse' } }}>
            {t('warehouseWork.open')}
          </TextLink>
        )}
      </header>
      {tabs.length > 0
        ? (
            <Tabs
              className={hasEditor ? '[&>[role=tablist]]:hidden' : undefined}
              defaultTabId={defaultTabId}
              items={tabs}
              key={focus?.id}
              label={t('warehouseWork.tabs')}
            />
          )
        : <EmptyState icon={Package} text={t('warehouseWork.noAccess')} />}
    </section>
  );
};

export const WarehouseWorkspace = (props: WarehouseWorkspaceProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(warehouseWorkSection);
  if (t !== undefined) {
    return <WarehouseWorkspaceContent {...props} t={t} />;
  }
  if (status === 'error') {
    return (
      <ChunkLoadNotice
        message={baseText('routing.chunkError.message')}
        onRetry={retry}
        recovery="retry"
        repeatedMessage={baseText('routing.chunkError.repeated')}
      />
    );
  }

  return <SkeletonGroup isFilled label={baseText('routing.section.loading')}><WarehouseSkeleton /></SkeletonGroup>;
};
