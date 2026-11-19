import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { Package } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { PrintPageValue } from '@/features/print-labels';

import {
  useCan,
  useCommandAccess,
} from '@/entities/session';
import { PrintLabels } from '@/features/print-labels';
import { useSceneSettingsStore } from '@/features/scene-settings';
import {
  isReadAccessDenied,
  parseApiError,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import { useViewportClass } from '@/shared/lib/viewport';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  ChunkLoadNotice,
  EmptyState,
  ErrorNotice,
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
import type { WarehouseConstructionChangeValue } from '../../model/warehouseSceneInteraction';
import type { WarehouseLayoutInitializeFormProps } from './WarehouseLayoutInitializeForm';

import { useAddWarehouseRack } from '../../api/useAddWarehouseRack';
import { useWarehouseLayoutDrafts } from '../../api/useWarehouseLayoutDrafts';
import { useWarehouseRackDraftSession } from '../../api/useWarehouseRackDraftSession';
import { canInitializeWarehouseLayout } from '../../model/canInitializeWarehouseLayout';
import { getWarehouseCells } from '../../model/warehouseCells';
import {
  createWarehouseRackGrid,
  findWarehouseRackObstacle,
} from '../../model/warehouseRackGrid';
import {
  createWarehouseRackPlacement,
  moveWarehouseRackPlacement,
} from '../../model/warehouseRackPlacement';
import { useWarehouseConstructionPreview } from './useWarehouseConstructionPreview';
import { WarehouseLayoutObserver } from './WarehouseLayoutObserver';
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
  shouldFocusGrid: boolean;
  topology: null | WarehouseTopology;
}

interface WarehouseRackPlacementProps {
  onEditingChange: (isEditing: boolean) => void;
  onPreviewChange: WarehouseConstructionChangeValue;
  query: UseQueryResult<null | WarehouseTopology>;
  t: WarehouseWorkTranslate;
  warehouseId: string;
}

const COMPACT_LAYOUT = [
  'max-h-[30dvh] overflow-y-auto overscroll-contain pr-2 pb-1 scroll-shadow-y [--warehouse-rack-grid-height:10rem]',
  'xl:max-h-[34dvh] xl:[--warehouse-placement-columns:minmax(0,3fr)_minmax(0,2fr)]',
].join(' ');

const loadLayoutInitialization = createCachedModuleLoader(() => import('./WarehouseLayoutInitializeForm'));

const WarehouseLayoutInitialization = (props: WarehouseLayoutInitializeFormProps): ReactElement => {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(loadLayoutInitialization);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    const Form = state.module.WarehouseLayoutInitializeForm;

    return <Form {...props} />;
  }
  if (state.kind === 'failed') {
    return (
      <ChunkLoadNotice
        message={t('routing.chunkError.message')}
        onRetry={load}
        recovery={state.recovery}
        repeatedMessage={t('routing.chunkError.repeated')}
      />
    );
  }

  return <Skeleton className="h-28 w-full" />;
};

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

const WarehouseRackEditor = ({
  onEditingChange, onPreviewChange, query, shouldFocusGrid, t, topology, warehouseId,
}: WarehouseRackEditorProps): ReactElement => {
  const { t: baseText } = useI18n();
  const [requestedRowId, setRequestedRowId] = useState<string>();
  const [saved, setSaved] = useState<WarehouseRackSavedValue>();
  const [selection, setSelection] = useState<RackSelectionValue>();
  const [isLeaving, setIsLeaving] = useState(false);
  const boardRef = useRef<HTMLButtonElement>(null);
  const { session, state: live } = useWarehouseRackDraftSession();
  const { drafts } = useWarehouseLayoutDrafts(topology, warehouseId);
  const otherDrafts = useMemo(() => drafts.filter(draft => draft.zoneId !== live.zoneId), [drafts, live.zoneId]);
  const selectedRowId = selection?.draft.rowId;
  const hasSaved = saved !== undefined;
  const { options, rowId, suggestion } = useMemo(() => {
    const options = topology?.storageZones.flatMap(zone => zone.rows.map(row => ({ row, zone }))) ?? [];
    const rowId = selectedRowId ?? options.find(({ row }) => row.id === requestedRowId)?.row.id ?? options[0]?.row.id;
    const canSuggest = topology !== null && rowId !== undefined && selectedRowId === undefined && !hasSaved;

    return { options, rowId, suggestion: canSuggest ? suggestPlacement(topology, rowId) : undefined };
  }, [hasSaved, requestedRowId, selectedRowId, topology]);
  const draft = selection?.draft ?? suggestion;

  const handleSaved = (result: WarehouseRackSavedValue): void => {
    setSelection(undefined);
    setSaved(result);
  };

  const published = live.published?.draft === selection?.draft ? live.published : undefined;
  const { attemptedDraft, command } = useAddWarehouseRack(warehouseId, draft, handleSaved, { commit: session.commit, published });
  const access = useCommandAccess(command.method, { kind: 'warehouse', warehouseId });
  const isAttemptActive = command.isPending || command.apiError?.isRetryable === true;
  const isDraftStale = draft !== undefined && draft.expectedRevision !== topology?.revision;
  const hasPublishConflict = live.error !== null && parseApiError(live.error).code === ErrorCode.VERSION_CONFLICT;
  const isVersionConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT || isDraftStale || hasPublishConflict;
  const isRefreshing = isVersionConflict && query.isFetching;
  const isEditing = selection !== undefined || isAttemptActive;
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(
    isEditing, undefined, { isContextChangeGuarded: true },
  );
  const displayedDraft = isAttemptActive ? attemptedDraft ?? draft : draft;
  const gridAnchor = selection?.gridAnchor ?? displayedDraft?.footprint;
  const gridSize = selection?.gridSize;
  const zoneId = displayedDraft?.zoneId;
  const grid = useMemo(
    () => gridAnchor === undefined
      ? undefined
      : createWarehouseRackGrid(topology, gridAnchor, gridSize, otherDrafts.map(draft => draft.footprint), zoneId),
    [gridAnchor, gridSize, otherDrafts, topology, zoneId],
  );
  const obstacle = grid === undefined || displayedDraft === undefined
    ? undefined
    : findWarehouseRackObstacle(grid, displayedDraft.footprint);
  const isRowMissing = displayedDraft !== undefined && !options.some(({ row }) => row.id === displayedDraft.rowId);
  const isGridReadOnly = isAttemptActive || isVersionConflict || isRowMissing || isLeavePending || isLeaving;
  const hasUnpublishedSelection = selection !== undefined && (published === undefined || live.isPublishing || live.error !== null);
  const isPlacementBlocked = !isAttemptActive && (isVersionConflict || isRowMissing || obstacle !== undefined || hasUnpublishedSelection);
  const isSaveBlocked = displayedDraft === undefined || isLeavePending || isLeaving || isPlacementBlocked;
  const canRetryDraft = selection !== undefined && !isGridReadOnly && obstacle === undefined;
  const constructionPlacement = saved === undefined && !isRowMissing ? displayedDraft : undefined;
  const boundedZoneId = options.find(option => option.row.id === rowId && option.zone.bounds !== undefined)?.zone.id;
  useWarehouseConstructionPreview(onPreviewChange, otherDrafts, constructionPlacement, obstacle !== undefined, boundedZoneId);

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
            const refreshed = moveWarehouseRackPlacement(updated, selection.draft.footprint.origin);
            const refreshedGrid = createWarehouseRackGrid(result.data, selection.gridAnchor, selection.gridSize, [], refreshed.zoneId);
            setSelection({ ...selection, draft: refreshed });
            session.select(findWarehouseRackObstacle(refreshedGrid, refreshed.footprint) === undefined ? refreshed : undefined);
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
    const moved = moveWarehouseRackPlacement(draft, origin);
    setSelection({
      draft: moved,
      gridAnchor,
      gridSize: hasSameGridSize ? gridSize : { depthMm, widthMm },
    });
    session.select(findWarehouseRackObstacle(grid, moved.footprint) === undefined ? moved : undefined);
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
    if (!isLeaving) {
      cancelLeave();
      boardRef.current?.focus();
    }
  };

  const handleConfirmLeave = (): void => {
    if (isLeaving) {
      return;
    }
    setIsLeaving(true);
    void session.release().then(() => {
      setIsLeaving(false);
      confirmLeave();
    });
  };

  const handleRetryDraft = (): void => {
    command.reset();
    session.retry();
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

  useEffect(() => {
    if (shouldFocusGrid) {
      boardRef.current?.focus();
    }
  }, [shouldFocusGrid]);

  if (options.length === 0 && saved === undefined && displayedDraft === undefined) {
    return <EmptyState icon={Package} text={t('warehouseWork.layoutEmpty')} />;
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" data-testid="warehouse-rack-placement">
      {saved === undefined
        ? (
            <>
              <h3 className="text-base font-semibold">{t('warehouseWork.rackTitle')}</h3>
              <div className="grid gap-3 grid-cols-[var(--warehouse-placement-columns,minmax(0,1fr))]">
                <div className="min-w-0 space-y-3">
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
                      drafts={otherDrafts}
                      footprint={displayedDraft.footprint}
                      grid={grid}
                      isReadOnly={isGridReadOnly}
                      obstacle={obstacle}
                      onMove={handleMove}
                      t={t}
                    />
                  )}
                </div>
                <div className="min-w-0 space-y-3">
                  {displayedDraft === undefined
                    ? <p role="status">{t('warehouseWork.rackNoPosition')}</p>
                    : <RackPreview draft={displayedDraft} t={t} />}
                  {live.error !== null && !hasPublishConflict && (
                    <ErrorNotice error={live.error} onRetry={canRetryDraft ? handleRetryDraft : undefined} />
                  )}
                  {live.isExpired && (
                    <div className="flex flex-wrap items-center gap-2" data-state="expired" data-testid="warehouse-rack-draft-status">
                      <p className="text-sm" role="alert">{t('warehouseWork.rackDraftExpired')}</p>
                      {canRetryDraft && <Button onClick={handleRetryDraft} variant="secondary">{baseText('common.retry')}</Button>}
                    </div>
                  )}
                  {live.error === null && (live.isPublishing || live.published !== undefined) && (
                    <p
                      className="text-sm text-on-panel-muted"
                      data-state={live.isPublishing ? 'publishing' : 'published'}
                      data-testid="warehouse-rack-draft-status"
                      role="status"
                    >
                      {t(live.isPublishing ? 'warehouseWork.rackDraftPublishing' : 'warehouseWork.rackDraftPublished')}
                    </p>
                  )}
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
                    <ActionButton
                      access={access}
                      command={command}
                      data-testid="warehouse-rack-submit"
                      errorPlacement={live.error === null ? 'below' : 'external'}
                      isDisabled={isSaveBlocked}
                    >
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
                      onLeave={handleConfirmLeave}
                      onStay={handleStay}
                      stayLabel={t('warehouseWork.stay')}
                    />
                  )}
                </div>
              </div>
            </>
          )
        : <RackSaved onNext={handleNext} query={query} saved={saved} t={t} topology={topology} />}
    </section>
  );
};

export const WarehouseRackPlacement = ({
  onEditingChange, onPreviewChange, query, t, warehouseId,
}: WarehouseRackPlacementProps): ReactElement => {
  const { t: baseText } = useI18n();
  const canEdit = useCan(PermissionCode.LAYOUT_EDIT, { kind: 'warehouse', warehouseId });
  const viewportClass = useViewportClass();
  const canShowScene = useSceneSettingsStore(state => state.preference !== 'off' && !state.isSceneUnavailable);
  const [dirtyEditor, setDirtyEditor] = useState<'initialize' | 'rack' | undefined>();
  const [didInitialize, setDidInitialize] = useState(false);
  const isCompact = canShowScene && viewportClass !== 'phone';

  const handleInitializeEditing = useCallback((isEditing: boolean): void => {
    setDirtyEditor(isEditing ? 'initialize' : undefined);
    onEditingChange(isEditing);
  }, [onEditingChange]);

  const handleRackEditing = useCallback((isEditing: boolean): void => {
    setDirtyEditor(isEditing ? 'rack' : undefined);
    onEditingChange(isEditing);
  }, [onEditingChange]);

  const handleInitialized = (): void => {
    setDidInitialize(true);
  };

  const handleRetry = (): void => {
    void query.refetch();
  };

  const renderLayout = (topology: null | WarehouseTopology): ReactElement => {
    if (!canEdit) {
      return <WarehouseLayoutObserver onPreviewChange={onPreviewChange} t={t} topology={topology} warehouseId={warehouseId} />;
    }
    if (dirtyEditor === 'initialize' || (dirtyEditor !== 'rack' && canInitializeWarehouseLayout(topology))) {
      return (
        <WarehouseLayoutInitialization
          onEditingChange={handleInitializeEditing}
          onInitialized={handleInitialized}
          query={query}
          t={t}
          warehouseId={warehouseId}
        />
      );
    }

    return (
      <WarehouseRackEditor
        onEditingChange={handleRackEditing}
        onPreviewChange={onPreviewChange}
        query={query}
        shouldFocusGrid={didInitialize}
        t={t}
        topology={topology}
        warehouseId={warehouseId}
      />
    );
  };

  if (isReadAccessDenied(query.error)) {
    return <EmptyState icon={Package} text={t('warehouseWork.noAccess')} />;
  }

  return (
    <div
      aria-label={isCompact ? t('warehouseWork.layout') : undefined}
      className={isCompact ? COMPACT_LAYOUT : undefined}
      role={isCompact ? 'region' : undefined}
      tabIndex={isCompact ? 0 : undefined}
    >
      <WidgetStates
        data={query.data}
        error={query.error}
        isRetrying={query.isFetching}
        loadingLabel={baseText('routing.section.loading')}
        onRetry={handleRetry}
        skeleton={<Skeleton className="h-28 w-full" />}
      >
        {renderLayout}
      </WidgetStates>
    </div>
  );
};
