import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { WarehouseStockService } from '@skladburg/contracts/wms/v1/stock';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import { useState } from 'react';

import type { WarehouseImportTemplateId } from '@/features/data-import';

import {
  useCommandAccess,
  useSessionQuery,
} from '@/entities/session';
import { useWarehousesQuery } from '@/entities/warehouse';
import {
  ImportPanelFrame,
  ImportWorkspace,
} from '@/features/data-import';
import { useActingContext } from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  Button,
  SelectField,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseImportTranslate } from '../../i18n/warehouseImportSection';

import {
  findWarehouseImportRuleKey,
  warehouseImportSection,
} from '../../i18n/warehouseImportSection';

interface WarehouseImportContentProps {
  t: WarehouseImportTranslate;
  templateId: WarehouseImportTemplateId;
  warehouseId: string;
}

interface WarehouseImportPanelProps {
  focusedWarehouseId: string | undefined;
  onClose: () => void;
}

const selectMembership = (session: GetSessionResponse): boolean =>
  session.memberships.some(membership => membership.organizationId === session.actingOrganizationId);

const isEmpty = (warehouses: readonly Warehouse[]): boolean => warehouses.length === 0;

const WarehouseImportContent = ({ t, templateId, warehouseId }: WarehouseImportContentProps): ReactElement => {
  const { locale } = useI18n();
  const isCells = templateId === 'warehouse_cells';
  const scope = { kind: 'warehouse', warehouseId } as const;
  const readAccess = useCommandAccess(
    isCells ? WarehouseTopologyService.method.getWarehouseTopology : WarehouseStockService.method.listStockBalances,
    scope,
  );
  const writeAccess = useCommandAccess(
    isCells ? WarehouseTopologyService.method.addWarehouseCells : WarehouseStockService.method.postOpeningStock,
    scope,
  );

  const getRuleMessage = (ruleId: string): string | undefined => {
    const key = findWarehouseImportRuleKey(locale, ruleId);

    return key === undefined ? undefined : t(key);
  };

  return (
    <ImportWorkspace
      instructions={(
        <div className="space-y-1 text-sm wrap-anywhere text-on-panel-muted">
          <p>{isCells ? t('warehouseImport.cells.instructions') : t('warehouseImport.stock.instructions')}</p>
          <p>{isCells ? t('warehouseImport.cells.example') : t('warehouseImport.stock.example')}</p>
          {!isCells && (
            <>
              <p>{t('warehouseImport.stock.exactQuantity')}</p>
              <p>{t('warehouseImport.stock.correction')}</p>
            </>
          )}
        </div>
      )}
      options={{
        formatRow: row => row.values.map(value => value === '' ? '—' : value).join(' · '),
        getRuleMessage,
        t,
        target: { kind: 'warehouse', templateId, warehouseId },
        writeAccess,
      }}
      readAccess={readAccess}
    />
  );
};

interface WarehouseImportControlsProps {
  focusedWarehouseId: string | undefined;
  onTemplateChange: (templateId: WarehouseImportTemplateId) => void;
  t: WarehouseImportTranslate;
  templateId: WarehouseImportTemplateId;
  warehouses: readonly Warehouse[];
}

const WarehouseImportControls = ({
  focusedWarehouseId,
  onTemplateChange,
  t,
  templateId,
  warehouses,
}: WarehouseImportControlsProps): ReactElement => {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | undefined>(undefined);

  const focusedWarehouse = warehouses.find(warehouse => warehouse.id === focusedWarehouseId);
  const defaultWarehouse = focusedWarehouse ?? (warehouses.length === 1 ? warehouses[0] : undefined);
  const requestedWarehouseId = selectedWarehouseId ?? defaultWarehouse?.id;
  const warehouseId = warehouses.find(warehouse => warehouse.id === requestedWarehouseId)?.id;

  const handleWarehouseChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedWarehouseId(event.currentTarget.value);
  };

  const handleTemplateChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const { value } = event.currentTarget;

    if (value === 'warehouse_cells' || value === 'opening_stock') {
      onTemplateChange(value);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
        <div className="min-w-0" data-testid="warehouse-import-warehouse">
          <SelectField
            label={t('warehouseImport.warehouse')}
            name="warehouse-import-warehouse"
            onChange={handleWarehouseChange}
            value={warehouseId ?? ''}
          >
            <option value="">{t('warehouseImport.selectWarehouse')}</option>
            {warehouses.map(warehouse => (
              <option data-testid={`warehouse-import-warehouse-option-${warehouse.id}`} key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="min-w-0" data-testid="warehouse-import-template">
          <SelectField
            label={t('warehouseImport.template')}
            name="warehouse-import-template"
            onChange={handleTemplateChange}
            value={templateId}
          >
            <option data-testid="warehouse-import-template-option-warehouse_cells" value="warehouse_cells">
              {t('warehouseImport.template.cells')}
            </option>
            <option data-testid="warehouse-import-template-option-opening_stock" value="opening_stock">
              {t('warehouseImport.template.stock')}
            </option>
          </SelectField>
        </div>
      </div>
      {warehouseId !== undefined && <WarehouseImportContent t={t} templateId={templateId} warehouseId={warehouseId} />}
    </>
  );
};

const WarehouseImportWarehouses = ({
  focusedWarehouseId,
  onTemplateChange,
  t,
  templateId,
}: Omit<WarehouseImportControlsProps, 'warehouses'>): ReactElement => {
  const query = useWarehousesQuery();

  const handleRetry = (): void => {
    void query.refetch();
  };

  return (
    <WidgetStates
      data={query.data}
      empty={<p className="text-sm text-on-panel-muted">{t('warehouseImport.empty')}</p>}
      error={query.error}
      isEmpty={isEmpty}
      isRetrying={query.isFetching}
      loadingLabel={t('dataImport.loading')}
      onRetry={handleRetry}
      skeleton={<Skeleton className="h-14 w-full" />}
    >
      {warehouses => (
        <WarehouseImportControls
          focusedWarehouseId={focusedWarehouseId}
          onTemplateChange={onTemplateChange}
          t={t}
          templateId={templateId}
          warehouses={warehouses}
        />
      )}
    </WidgetStates>
  );
};

const WarehouseImportSelection = ({ focusedWarehouseId, onClose }: WarehouseImportPanelProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { data: isMember, error, isFetching, refetch } = useSessionQuery({ select: selectMembership });
  const { retry, status, t } = useCatalogSection(warehouseImportSection);
  const [templateId, setTemplateId] = useState<WarehouseImportTemplateId>('warehouse_cells');

  const title = t?.(templateId === 'warehouse_cells' ? 'warehouseImport.cells.title' : 'warehouseImport.stock.title')
    ?? mainT('routing.section.loading');

  const handleRetry = (): void => {
    void refetch();
  };

  return (
    <ImportPanelFrame
      closeLabel={t?.('dataImport.back') ?? mainT('hud.inspector.close')}
      kind="warehouse"
      onClose={onClose}
      title={title}
    >
      {status === 'loading' && <Skeleton className="h-20 w-full" />}
      {status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert">{mainT('routing.chunkError.message')}</p>
          <Button onClick={retry} variant="secondary">{mainT('common.retry')}</Button>
        </div>
      )}
      {t !== undefined && (
        <WidgetStates
          data={isMember}
          error={error}
          isRetrying={isFetching}
          loadingLabel={t('dataImport.loading')}
          onRetry={handleRetry}
          skeleton={<Skeleton className="h-20 w-full" />}
        >
          {member => member
            ? (
                <WarehouseImportWarehouses
                  focusedWarehouseId={focusedWarehouseId}
                  onTemplateChange={setTemplateId}
                  t={t}
                  templateId={templateId}
                />
              )
            : <p role="status">{t('warehouseImport.memberOnly')}</p>}
        </WidgetStates>
      )}
    </ImportPanelFrame>
  );
};

export const WarehouseImportPanel = (props: WarehouseImportPanelProps): ReactElement => {
  const { organizationId, userId } = useActingContext();

  return <WarehouseImportSelection {...props} key={JSON.stringify([organizationId, userId])} />;
};
