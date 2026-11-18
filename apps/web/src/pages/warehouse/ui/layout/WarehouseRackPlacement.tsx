import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { Package } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { PrintPageValue } from '@/features/print-labels';

import { useCommandAccess } from '@/entities/session';
import { PrintLabels } from '@/features/print-labels';
import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  ActionButton,
  Button,
  EmptyState,
  SelectField,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseRackSavedValue } from '../../api/addWarehouseRack';
import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { WarehouseRackPlacementValue } from '../../model/warehouseRackPlacement';

import { useAddWarehouseRack } from '../../api/useAddWarehouseRack';
import { getWarehouseCells } from '../../model/warehouseCells';
import { createWarehouseRackPlacement } from '../../model/warehouseRackPlacement';

interface RackPreviewProps {
  draft: WarehouseRackPlacementValue;
  t: WarehouseWorkTranslate;
}

interface WarehouseRackEditorProps extends WarehouseRackPlacementProps {
  topology: WarehouseTopology;
}

interface WarehouseRackPlacementProps {
  query: UseQueryResult<null | WarehouseTopology>;
  t: WarehouseWorkTranslate;
}

const RackPreview = ({ draft, t }: RackPreviewProps): ReactElement => {
  const { formatNumber } = useI18n();
  const { depthMm, origin: { xMm, zMm }, widthMm } = draft.footprint;

  return (
    <div className="space-y-2 rounded-control border border-line bg-panel-solid p-3" data-testid="warehouse-rack-preview">
      <p className="font-semibold">{t('warehouseWork.rackPreview', { code: draft.rackCode })}</p>
      <p className="text-sm text-on-panel-muted">
        {t('warehouseWork.rackPosition', { x: formatNumber(xMm), z: formatNumber(zMm) })}
        {' · '}
        {t('warehouseWork.rackSize', { depth: formatNumber(depthMm), width: formatNumber(widthMm) })}
      </p>
      <ul className="grid gap-1 text-sm tabular-nums wrap-anywhere @sm:grid-cols-2">
        {draft.cells.map(({ cellCode }) => <li key={cellCode}>{cellCode}</li>)}
      </ul>
    </div>
  );
};

interface RackSavedProps extends WarehouseRackEditorProps {
  onNext: () => void;
  saved: WarehouseRackSavedValue;
}

const RackSaved = ({ onNext, query, saved, t, topology }: RackSavedProps): ReactElement => {
  const headingRef = useRef<HTMLParagraphElement>(null);
  const codes = new Set(saved.draft.cells.map(cell => cell.cellCode));
  const addresses = getWarehouseCells(topology).filter(cell => codes.has(cell.code));
  const hasAddresses = topology.revision >= saved.revision && addresses.length === codes.size;
  const isErrorShown = query.error !== null && !query.isFetching;

  const handleRefresh = (): void => {
    void query.refetch();
  };

  const getPages = async (): Promise<PrintPageValue[]> => {
    const { cellPrintPage } = await import('../../model/warehouseLabelPages');

    return addresses.map(cellPrintPage);
  };

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="font-semibold" data-testid="warehouse-rack-saved" ref={headingRef} role="status" tabIndex={-1}>
        {t('warehouseWork.rackSaved', { code: saved.draft.rackCode })}
      </p>
      {hasAddresses
        ? <PrintLabels getPages={getPages} label={t('warehouseWork.printRack')} testId="warehouse-rack-print" />
        : (
            <>
              <p className="text-sm text-on-panel-muted" role={isErrorShown ? 'alert' : 'status'}>
                {t(isErrorShown ? 'warehouseWork.rackAddressesFailed' : 'warehouseWork.rackWaitingForAddresses')}
              </p>
              <Button disabled={query.isFetching} onClick={handleRefresh} variant="secondary">{t('warehouseWork.rackRefresh')}</Button>
            </>
          )}
      <Button disabled={!hasAddresses} onClick={onNext} variant="secondary">{t('warehouseWork.rackNext')}</Button>
    </div>
  );
};

const WarehouseRackEditor = ({ query, t, topology }: WarehouseRackEditorProps): ReactElement => {
  const [requestedRowId, setRequestedRowId] = useState<string>();
  const [saved, setSaved] = useState<WarehouseRackSavedValue>();
  const options = topology.storageZones.flatMap(zone => zone.rows.map(row => ({ row, zone })));
  const rowId = options.find(({ row }) => row.id === requestedRowId)?.row.id ?? options[0]?.row.id;
  const draft = rowId === undefined || saved !== undefined ? undefined : createWarehouseRackPlacement(topology, rowId);
  const { attemptedDraft, command } = useAddWarehouseRack(topology.warehouseId, draft, setSaved);
  const access = useCommandAccess(command.method, { kind: 'warehouse', warehouseId: topology.warehouseId });
  const isVersionConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isAttemptActive = command.isPending || command.apiError?.isRetryable === true;
  const isRefreshing = isVersionConflict && query.isFetching;
  const displayedDraft = isAttemptActive ? attemptedDraft ?? draft : draft;

  const handleRowChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setRequestedRowId(event.currentTarget.value);
    command.reset();
  };

  const handleRefresh = (): void => {
    void query.refetch().then((result) => {
      if (!result.isError) {
        command.reset();
      }
    });
  };

  const handleNext = (): void => {
    setSaved(undefined);
  };

  return (
    <section className="flex min-w-0 flex-col gap-3" data-testid="warehouse-rack-placement">
      {saved === undefined
        ? (
            <>
              <h3 className="text-base font-semibold">{t('warehouseWork.rackTitle')}</h3>
              <div className="max-w-96" data-testid="warehouse-rack-row">
                <SelectField
                  isReadOnly={isAttemptActive || isRefreshing}
                  label={t('warehouseWork.rackRow')}
                  name="warehouse-rack-row"
                  onChange={handleRowChange}
                  value={rowId}
                >
                  {options.map(({ row, zone }) => (
                    <option key={row.id} value={row.id}>{t('warehouseWork.rackRowOption', { row: row.code, zone: zone.code })}</option>
                  ))}
                </SelectField>
              </div>
              {displayedDraft === undefined
                ? <p role="status">{t('warehouseWork.rackNoPosition')}</p>
                : <RackPreview draft={displayedDraft} t={t} />}
              <ActionButton
                access={access}
                command={command}
                data-testid="warehouse-rack-submit"
                isDisabled={displayedDraft === undefined || isVersionConflict || isRefreshing}
              >
                {t('warehouseWork.rackSubmit')}
              </ActionButton>
              {isVersionConflict && (
                <Button disabled={isRefreshing} onClick={handleRefresh} variant="secondary">{t('warehouseWork.rackRefresh')}</Button>
              )}
            </>
          )
        : <RackSaved onNext={handleNext} query={query} saved={saved} t={t} topology={topology} />}
    </section>
  );
};

const isLayoutEmpty = (topology: null | WarehouseTopology): boolean =>
  topology?.storageZones.some(zone => zone.rows.length > 0) !== true;

export const WarehouseRackPlacement = ({ query, t }: WarehouseRackPlacementProps): ReactElement => {
  const { t: baseText } = useI18n();

  const handleRetry = (): void => {
    void query.refetch();
  };

  if (isReadAccessDenied(query.error)) {
    return <EmptyState icon={Package} text={t('warehouseWork.noAccess')} />;
  }

  return (
    <WidgetStates
      data={query.data}
      empty={<EmptyState icon={Package} text={t('warehouseWork.layoutEmpty')} />}
      error={query.error}
      isEmpty={isLayoutEmpty}
      isRetrying={query.isFetching}
      loadingLabel={baseText('routing.section.loading')}
      onRetry={handleRetry}
      skeleton={<Skeleton className="h-28 w-full" />}
    >
      {topology => topology !== null && <WarehouseRackEditor query={query} t={t} topology={topology} />}
    </WidgetStates>
  );
};
