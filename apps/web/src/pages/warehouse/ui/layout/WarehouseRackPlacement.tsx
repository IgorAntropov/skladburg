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
  useMemo,
  useRef,
  useState,
} from 'react';

import type { PrintPageValue } from '@/features/print-labels';

import { useCommandAccess } from '@/entities/session';
import { PrintLabels } from '@/features/print-labels';
import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  EmptyState,
  LeaveConfirm,
  SelectField,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseRackSavedValue } from '../../api/addWarehouseRack';
import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type {
  WarehouseRackFootprintValue,
  WarehouseRackGridValue,
  WarehouseRackPositionValue,
} from '../../model/warehouseRackGrid';
import type { WarehouseRackPlacementValue } from '../../model/warehouseRackPlacement';

import { useAddWarehouseRack } from '../../api/useAddWarehouseRack';
import { getWarehouseCells } from '../../model/warehouseCells';
import {
  createWarehouseRackGrid,
  findWarehouseRackObstacle,
} from '../../model/warehouseRackGrid';
import {
  createWarehouseRackPlacement,
  moveWarehouseRackPlacement,
} from '../../model/warehouseRackPlacement';
import { WarehouseRackGrid } from './WarehouseRackGrid';

interface RackPreviewProps {
  draft: WarehouseRackPlacementValue;
  t: WarehouseWorkTranslate;
}

interface RackSelectionValue {
  draft: WarehouseRackPlacementValue;
  gridAnchor: WarehouseRackFootprintValue;
  gridSize: Pick<WarehouseRackGridValue, 'depthMm' | 'widthMm'>;
}

const suggestPlacement = (topology: WarehouseTopology, rowId: string): undefined | WarehouseRackPlacementValue =>
  createWarehouseRackPlacement(topology, rowId) ?? createWarehouseRackPlacement(topology, rowId, { xMm: 0, zMm: 0 });

interface WarehouseRackEditorProps extends WarehouseRackPlacementProps {
  topology: null | WarehouseTopology;
}

interface WarehouseRackPlacementProps {
  onEditingChange: (isEditing: boolean) => void;
  query: UseQueryResult<null | WarehouseTopology>;
  t: WarehouseWorkTranslate;
  warehouseId: string;
}

const RackPreview = ({ draft, t }: RackPreviewProps): ReactElement => {
  const { formatNumber } = useI18n();
  const { depthMm, origin: { xMm, zMm }, widthMm } = draft.footprint;

  return (
    <div className="space-y-2 rounded-control border border-line bg-panel-solid p-3" data-testid="warehouse-rack-preview">
      <p className="font-semibold">{t('warehouseWork.rackPreview', { code: draft.rackCode })}</p>
      <p className="text-sm text-on-panel-muted" data-testid="warehouse-rack-coordinates">
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

interface RackSavedProps extends Pick<WarehouseRackEditorProps, 'query' | 't' | 'topology'> {
  onNext: () => void;
  saved: WarehouseRackSavedValue;
}

const RackSaved = ({ onNext, query, saved, t, topology }: RackSavedProps): ReactElement => {
  const headingRef = useRef<HTMLParagraphElement>(null);
  const codes = new Set(saved.draft.cells.map(cell => cell.cellCode));
  const addresses = getWarehouseCells(topology).filter(cell => codes.has(cell.code));
  const hasAddresses = topology !== null && topology.revision >= saved.revision && addresses.length === codes.size;
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

const WarehouseRackEditor = ({ onEditingChange, query, t, topology, warehouseId }: WarehouseRackEditorProps): ReactElement => {
  const [requestedRowId, setRequestedRowId] = useState<string>();
  const [saved, setSaved] = useState<WarehouseRackSavedValue>();
  const [selection, setSelection] = useState<RackSelectionValue>();
  const boardRef = useRef<HTMLButtonElement>(null);
  const options = topology?.storageZones.flatMap(zone => zone.rows.map(row => ({ row, zone }))) ?? [];
  const rowId = selection?.draft.rowId ?? options.find(({ row }) => row.id === requestedRowId)?.row.id ?? options[0]?.row.id;
  const canSuggest = topology !== null && rowId !== undefined && selection === undefined && saved === undefined;
  const suggestion = canSuggest ? suggestPlacement(topology, rowId) : undefined;
  const draft = selection?.draft ?? suggestion;

  const handleSaved = (result: WarehouseRackSavedValue): void => {
    setSelection(undefined);
    setSaved(result);
  };

  const { attemptedDraft, command } = useAddWarehouseRack(warehouseId, draft, handleSaved);
  const access = useCommandAccess(command.method, { kind: 'warehouse', warehouseId });
  const isAttemptActive = command.isPending || command.apiError?.isRetryable === true;
  const isDraftStale = draft !== undefined && draft.expectedRevision !== topology?.revision;
  const isVersionConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT || isDraftStale;
  const isRefreshing = isVersionConflict && query.isFetching;
  const isEditing = selection !== undefined || isAttemptActive;
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(
    isEditing, undefined, { isContextChangeGuarded: true },
  );
  const displayedDraft = isAttemptActive ? attemptedDraft ?? draft : draft;
  const gridAnchor = selection?.gridAnchor ?? displayedDraft?.footprint;
  const gridSize = selection?.gridSize;
  const grid = useMemo(
    () => gridAnchor === undefined ? undefined : createWarehouseRackGrid(topology, gridAnchor, gridSize),
    [gridAnchor, gridSize, topology],
  );
  const obstacle = grid === undefined || displayedDraft === undefined
    ? undefined
    : findWarehouseRackObstacle(grid, displayedDraft.footprint);
  const isRowMissing = displayedDraft !== undefined && !options.some(({ row }) => row.id === displayedDraft.rowId);
  const isGridReadOnly = isAttemptActive || isVersionConflict || isRowMissing || isLeavePending;
  const isPlacementBlocked = !isAttemptActive && (isVersionConflict || isRowMissing || obstacle !== undefined);
  const isSaveBlocked = displayedDraft === undefined || isLeavePending || isPlacementBlocked;

  const handleRowChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setRequestedRowId(event.currentTarget.value);
    command.reset();
  };

  const handleRefresh = (): void => {
    void query.refetch().then((result) => {
      if (!result.isError) {
        if (selection !== undefined && result.data !== undefined && result.data !== null) {
          const updated = suggestPlacement(result.data, selection.draft.rowId);
          if (updated !== undefined) {
            setSelection({ ...selection, draft: moveWarehouseRackPlacement(updated, selection.draft.footprint.origin) });
          }
        }
        command.reset();
      }
    });
  };

  const handleMove = (origin: WarehouseRackPositionValue): void => {
    if (draft === undefined || grid === undefined || gridAnchor === undefined || isGridReadOnly) {
      return;
    }
    const current = draft.footprint.origin;
    if (current.xMm === origin.xMm && current.zMm === origin.zMm) {
      return;
    }

    const { depthMm, widthMm } = grid;
    const hasSameGridSize = gridSize?.depthMm === depthMm && gridSize.widthMm === widthMm;
    setSelection({
      draft: moveWarehouseRackPlacement(draft, origin),
      gridAnchor,
      gridSize: hasSameGridSize ? gridSize : { depthMm, widthMm },
    });
    command.reset();
  };

  const handleDiscard = (): void => {
    requestLeave(() => {
      setSelection(undefined);
      command.reset();
      boardRef.current?.focus();
    });
  };

  const handleStay = (): void => {
    cancelLeave();
    boardRef.current?.focus();
  };

  const handleNext = (): void => {
    setSaved(undefined);
  };

  useEffect(() => {
    onEditingChange(isEditing);

    return (): void => {
      onEditingChange(false);
    };
  }, [isEditing, onEditingChange]);

  if (options.length === 0 && saved === undefined && displayedDraft === undefined) {
    return <EmptyState icon={Package} text={t('warehouseWork.layoutEmpty')} />;
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" data-testid="warehouse-rack-placement">
      {saved === undefined
        ? (
            <>
              <h3 className="text-base font-semibold">{t('warehouseWork.rackTitle')}</h3>
              <div className="max-w-96" data-testid="warehouse-rack-row">
                <SelectField
                  isReadOnly={isEditing || isRefreshing}
                  label={t('warehouseWork.rackRow')}
                  name="warehouse-rack-row"
                  onChange={handleRowChange}
                  value={displayedDraft?.rowId ?? rowId}
                >
                  {isRowMissing && <option value={displayedDraft.rowId}>{t('warehouseWork.rackGridRowRemoved')}</option>}
                  {options.map(({ row, zone }) => (
                    <option key={row.id} value={row.id}>{t('warehouseWork.rackRowOption', { row: row.code, zone: zone.code })}</option>
                  ))}
                </SelectField>
              </div>
              {displayedDraft !== undefined && grid !== undefined && (
                <WarehouseRackGrid
                  boardRef={boardRef}
                  footprint={displayedDraft.footprint}
                  grid={grid}
                  isReadOnly={isGridReadOnly}
                  obstacle={obstacle}
                  onMove={handleMove}
                  t={t}
                />
              )}
              {displayedDraft === undefined
                ? <p role="status">{t('warehouseWork.rackNoPosition')}</p>
                : <RackPreview draft={displayedDraft} t={t} />}
              {isRowMissing && <p className="text-sm" role="status">{t('warehouseWork.rackGridRowUnavailable')}</p>}
              {isVersionConflict && !isAttemptActive && !isRowMissing && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm" role="status">{t('warehouseWork.rackGridChanged')}</p>
                  <Button disabled={isRefreshing || isLeavePending} onClick={handleRefresh} variant="secondary">
                    {t('warehouseWork.rackRefresh')}
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap items-start gap-2">
                <ActionButton access={access} command={command} data-testid="warehouse-rack-submit" isDisabled={isSaveBlocked}>
                  {t('warehouseWork.rackSubmit')}
                </ActionButton>
                {isEditing && !command.isPending && (
                  <Button
                    data-testid="warehouse-rack-cancel"
                    disabled={isRefreshing || isLeavePending}
                    onClick={handleDiscard}
                    variant="secondary"
                  >
                    {t('warehouseWork.cancel')}
                  </Button>
                )}
              </div>
              {isLeavePending && (
                <LeaveConfirm
                  data-testid="warehouse-rack-leave"
                  leaveLabel={t('warehouseWork.leave')}
                  message={t('warehouseWork.rackGridLeave')}
                  onLeave={confirmLeave}
                  onStay={handleStay}
                  stayLabel={t('warehouseWork.stay')}
                />
              )}
            </>
          )
        : <RackSaved onNext={handleNext} query={query} saved={saved} t={t} topology={topology} />}
    </section>
  );
};

export const WarehouseRackPlacement = ({ onEditingChange, query, t, warehouseId }: WarehouseRackPlacementProps): ReactElement => {
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
      error={query.error}
      isRetrying={query.isFetching}
      loadingLabel={baseText('routing.section.loading')}
      onRetry={handleRetry}
      skeleton={<Skeleton className="h-28 w-full" />}
    >
      {topology => (
        <WarehouseRackEditor onEditingChange={onEditingChange} query={query} t={t} topology={topology} warehouseId={warehouseId} />
      )}
    </WidgetStates>
  );
};
