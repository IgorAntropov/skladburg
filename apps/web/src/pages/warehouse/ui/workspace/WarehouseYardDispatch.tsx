import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type {
  ReceivingTask,
  YardWaitingReason,
} from '@skladburg/contracts/wms/v1/receiving';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  YardDispatchOutcome,
  YardWaitingReasonCode,
} from '@skladburg/contracts/wms/v1/receiving';
import { Truck } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useCan,
  useCommandAccess,
  useSessionQuery,
} from '@/entities/session';
import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  AccessButton,
  Button,
  EmptyState,
  Skeleton,
  TextLink,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseWorkspaceValue } from '../../api/useWarehouseWorkspace';
import type { YardDispatchResultValue } from '../../api/useYardDispatchForm';
import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type {
  WarehouseYardDockChoiceValue,
  WarehouseYardDragOptionsValue,
} from '../../model/warehouseYardDockChoice';
import type { YardDispatchVisitValue } from '../../model/yardDispatchRows';
import type {
  YardDispatchIntentValue,
  YardDispatchSnapshotValue,
} from './WarehouseYardDispatchForm';

import { useWarehouseYardClock } from '../../api/useWarehouseYardClock';
import { yardDispatchMethods } from '../../api/useYardDispatchForm';
import { useYardWaitingReasons } from '../../api/useYardWaitingReasons';
import { readYardSlotMinutes } from '../../model/yardDispatchClock';
import { readYardDispatchGroups } from '../../model/yardDispatchRows';
import { WarehouseYardDispatchForm } from './WarehouseYardDispatchForm';
import { WarehouseYardWaiting } from './WarehouseYardWaiting';

interface WarehouseYardDispatchProps {
  dockChoice: undefined | WarehouseYardDockChoiceValue;
  onConsumeDockChoice: (choice: WarehouseYardDockChoiceValue) => void;
  onDragOptionsChange: (options: undefined | WarehouseYardDragOptionsValue) => void;
  onEditingChange: (isEditing: boolean) => void;
  receiving: WarehouseWorkspaceValue['receiving'];
  t: WarehouseWorkTranslate;
  topology: undefined | WarehouseWorkspaceValue['topology'];
  warehouse: Warehouse;
}

interface YardVisitRowProps {
  canManage: boolean;
  canViewDeals: boolean;
  dockCodes: ReadonlyMap<string, string>;
  isSelected: boolean;
  onOpen: (intent: YardDispatchIntentValue) => void;
  onSelect: (taskId: string) => void;
  t: WarehouseWorkTranslate;
  timeZone: string;
  visit: YardDispatchVisitValue;
  warehouseId: string;
  worldTimeMs: number | undefined;
}

const OUTCOME_TEXT = {
  [YardDispatchOutcome.DOCK_ASSIGNED]: 'warehouseWork.yardDispatchAssignedResult',
  [YardDispatchOutcome.SLOT_BOOKED]: 'warehouseWork.yardDispatchBookedResult',
  [YardDispatchOutcome.UNSPECIFIED]: 'warehouseWork.yardDispatchConfirmed',
  [YardDispatchOutcome.WAITING]: 'warehouseWork.yardDispatchPromotedResult',
} as const;

const readTaskLabel = (task: ReceivingTask, t: WarehouseWorkTranslate): string =>
  t('warehouseWork.yardDispatchVisit', { number: task.sourceDocumentNumber || task.id.slice(-8) });

const readSnapshot = (
  task: ReceivingTask | undefined,
  reason: undefined | YardWaitingReason,
): YardDispatchSnapshotValue => ({
  options: task?.version === reason?.taskVersion ? reason?.dispatchOptions : undefined,
  version: task?.version,
});

const YardVisitRow = ({
  canManage, canViewDeals, dockCodes, isSelected, onOpen, onSelect, t, timeZone, visit, warehouseId, worldTimeMs,
}: YardVisitRowProps): ReactElement => {
  const { formatDateTime, formatNumber } = useI18n();
  const detailsId = useId();
  const scope = { kind: 'warehouse', warehouseId } as const;
  const promotionAccess = useCommandAccess(yardDispatchMethods.promoteYardVisit, scope);
  const assignmentAccess = useCommandAccess(yardDispatchMethods.assignYardVisitToDock, scope);
  const { reason, slotEndMs, slotStartMs, state, task, unloadingPointId: dockId } = visit;
  const rank = reason?.queuePosition;
  const dockCode = dockId === undefined ? undefined : (dockCodes.get(dockId) ?? dockId.slice(-8));
  const isDocked = state === 'assigned' || state === 'unloading';
  const hasSlot = slotStartMs !== undefined && slotEndMs !== undefined;
  const minutes = state === 'slot' && slotStartMs !== undefined && worldTimeMs !== undefined
    ? readYardSlotMinutes(slotStartMs, worldTimeMs)
    : undefined;
  const options = reason?.dispatchOptions;
  const canShowCommands = canManage && options !== undefined;
  const canPromote = options?.canPromote === true;
  const canAssign = (options?.assignableUnloadingPointIds.length ?? 0) > 0;
  const taskLabel = readTaskLabel(task, t);
  const hasBusyReservation = reason?.reason === YardWaitingReasonCode.BOOKED_DOCK_BUSY;
  const shouldReadReason = reason !== undefined && (!hasSlot || reason.reason !== YardWaitingReasonCode.WAITING_SLOT || isSelected);
  const dockLabel = dockCode === undefined ? undefined : t('warehouseWork.dock', { code: dockCode });

  const handleSelect = (): void => {
    onSelect(task.id);
  };

  const handlePromote = (): void => {
    onOpen({ action: 'promote', initialDockId: '', taskId: task.id, taskLabel, taskVersion: task.version });
  };

  const handleAssign = (): void => {
    onOpen({ action: 'assign', initialDockId: '', taskId: task.id, taskLabel, taskVersion: task.version });
  };

  return (
    <li
      className="flex min-w-0 flex-col gap-1 rounded-control border border-line p-3"
      data-queue-position={rank}
      data-task-id={task.id}
      data-testid="yard-dispatch-visit"
      data-yard-state={state}
    >
      <Button
        aria-controls={detailsId}
        aria-expanded={isSelected}
        className="w-fit max-w-full justify-start text-left wrap-anywhere"
        data-testid="yard-dispatch-select"
        onClick={handleSelect}
        variant="secondary"
      >
        {rank === undefined ? taskLabel : t('warehouseWork.yardDispatchRankedVisit', { position: formatNumber(rank), visit: taskLabel })}
      </Button>
      {isDocked && (
        <p className="text-sm">{t(state === 'assigned' ? 'warehouseWork.yardDispatchAtDock' : 'warehouseWork.yardDispatchUnloading')}</p>
      )}
      {dockLabel !== undefined && <p className="text-sm" data-testid="yard-dispatch-visit-dock">{dockLabel}</p>}
      {isDocked && task.expectedUnits.length > 0 && (
        <p className="text-sm tabular-nums">
          {t('warehouseWork.received', { count: task.receivedUnits.length, total: task.expectedUnits.length })}
        </p>
      )}
      {hasSlot && (
        <p className="text-sm text-on-panel-muted tabular-nums">
          {t('warehouseWork.yardDispatchSlotInterval', {
            end: formatDateTime(slotEndMs, { timeZone }), start: formatDateTime(slotStartMs, { timeZone }),
          })}
        </p>
      )}
      {minutes !== undefined && (
        <p className="text-sm tabular-nums" data-minutes={minutes} data-task-id={task.id} data-testid="yard-dispatch-slot-timer">
          {minutes > 0
            ? t('warehouseWork.yardDispatchMinutes', { minutes: formatNumber(minutes) })
            : t(hasBusyReservation ? 'warehouseWork.yardBookedDockBusy' : 'warehouseWork.yardDispatchCheckingSlot')}
        </p>
      )}
      {reason !== undefined && shouldReadReason && (
        <WarehouseYardWaiting reason={reason} schedule={task.dockSchedule} t={t} timeZone={timeZone} />
      )}
      <div className="flex flex-wrap items-center gap-2" hidden={!isSelected} id={detailsId}>
        {isSelected && canViewDeals && (
          <TextLink size="sm" to={{ kind: 'object', object: { id: task.dealId, type: 'deal' } }}>
            {t('warehouseWork.deal')}
          </TextLink>
        )}
        {isSelected && canShowCommands && (
          <>
            <AccessButton
              access={promotionAccess}
              data-testid="yard-dispatch-promote"
              isDisabled={!canPromote}
              onClick={handlePromote}
              variant="secondary"
            >
              {t('warehouseWork.yardDispatchPromote')}
            </AccessButton>
            <AccessButton
              access={assignmentAccess}
              data-testid="yard-dispatch-assign"
              isDisabled={!canAssign}
              onClick={handleAssign}
              variant="secondary"
            >
              {t('warehouseWork.yardDispatchAssign')}
            </AccessButton>
          </>
        )}
      </div>
    </li>
  );
};

export const WarehouseYardDispatch = ({
  dockChoice, onConsumeDockChoice, onDragOptionsChange, onEditingChange, receiving, t, topology, warehouse,
}: WarehouseYardDispatchProps): ReactElement => {
  const canViewDeals = useCan(PermissionCode.DEAL_VIEW, { kind: 'organization' });
  const canManageYard = useCan(PermissionCode.YARD_MANAGE, { kind: 'warehouse', warehouseId: warehouse.id });
  const { data: session } = useSessionQuery();
  const waiting = useYardWaitingReasons(warehouse.id, true);
  const [selectedId, setSelectedId] = useState<string>();
  const [intent, setIntent] = useState<YardDispatchIntentValue>();
  const [result, setResult] = useState<YardDispatchResultValue>();
  const [lastDockChoice, setLastDockChoice] = useState<WarehouseYardDockChoiceValue>();
  const panelRef = useRef<HTMLElement>(null);
  const isMember = session?.memberships.some(membership => membership.organizationId === session.actingOrganizationId) === true;
  const canManage = canManageYard && isMember;
  const error = receiving.error ?? waiting.error;
  const isReadDenied = isReadAccessDenied(error);
  const reasonByTask = useMemo(() => new Map(waiting.data?.map(reason => [reason.receivingTaskId, reason])), [waiting.data]);
  const area = topology?.data?.receivingArea;
  const dockCodes = useMemo(() => new Map(
    [area?.unloadingPoint, ...area?.additionalUnloadingPoints ?? []].flatMap(point => point === undefined ? [] : [[point.id, point.code]]),
  ), [area]);
  const groups = useMemo(() => receiving.data === undefined || waiting.data === undefined || isReadDenied
    ? undefined
    : readYardDispatchGroups(receiving.data, reasonByTask), [isReadDenied, reasonByTask, receiving.data, waiting.data]);
  const boundaries = useMemo(() => (groups?.slots.flatMap(({ slotEndMs, slotStartMs }) =>
    [slotStartMs, slotEndMs].filter(value => value !== undefined)) ?? []).sort((current, prev) => current - prev), [groups]);
  const slotStarts = useMemo(() => groups?.slots.flatMap(({ slotStartMs }) => slotStartMs ?? []) ?? [], [groups]);
  const isClockEnabled = groups !== undefined && (groups.queue.length > 0 || groups.slots.length > 0);
  const dragOptions = useMemo<undefined | WarehouseYardDragOptionsValue>(() => {
    if (!canManage || intent !== undefined || error !== null || groups === undefined || !dockCodes.size) {
      return undefined;
    }

    const options = new Map<string, { taskVersion: number; unloadingPointIds: readonly string[] }>();
    for (const { reason, task } of [...groups.queue, ...groups.slots, ...groups.waiting]) {
      const ids = reason?.dispatchOptions?.assignableUnloadingPointIds;
      if (ids !== undefined && ids.length > 0) {
        options.set(task.id, { taskVersion: task.version, unloadingPointIds: ids });
      }
    }
    return options.size === 0 ? undefined : options;
  }, [canManage, dockCodes, error, groups, intent]);

  const readReceiving = receiving.refetch;
  const readWaiting = waiting.refetch;
  const handleTimeRefresh = useCallback((): void => {
    void readWaiting({ cancelRefetch: false });
  }, [readWaiting]);
  const handleDataRefresh = useCallback((): void => {
    void readReceiving({ cancelRefetch: false });
    void readWaiting({ cancelRefetch: false });
  }, [readReceiving, readWaiting]);
  const worldTimeMs = useWarehouseYardClock(boundaries, slotStarts, isClockEnabled, handleTimeRefresh, handleDataRefresh);

  const handleSelect = (taskId: string): void => {
    setSelectedId(prev => prev === taskId ? undefined : taskId);
  };

  const handleOpen = (next: YardDispatchIntentValue): void => {
    setResult(undefined);
    setSelectedId(next.taskId);
    setIntent(next);
  };

  const handleClose = (): void => {
    setIntent(undefined);
    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"][data-testid="yard-dispatch-select"]')?.focus();
    });
  };

  const handleSuccess = (confirmed: YardDispatchResultValue): void => {
    handleClose();
    setResult(confirmed);
  };

  const handleReview = async (taskId: string): Promise<YardDispatchSnapshotValue> => {
    const [currentTasks, currentReasons] = await Promise.all([
      readReceiving({ cancelRefetch: false }),
      readWaiting({ cancelRefetch: false }),
    ]);
    if (currentTasks.isError || currentReasons.isError) {
      return { options: undefined, version: undefined };
    }
    return readSnapshot(currentTasks.data?.find(task => task.id === taskId),
      currentReasons.data?.find(reason => reason.receivingTaskId === taskId));
  };

  if (dockChoice !== undefined && dockChoice !== lastDockChoice) {
    setLastDockChoice(dockChoice);
    const current = receiving.data?.find(task => task.id === dockChoice.taskId);
    if (current !== undefined && intent === undefined && canManage) {
      handleOpen({
        action: 'assign', initialDockId: dockChoice.unloadingPointId, taskId: dockChoice.taskId,
        taskLabel: readTaskLabel(current, t), taskVersion: dockChoice.taskVersion,
      });
    }
  }

  useEffect(() => {
    if (dockChoice !== undefined) {
      onConsumeDockChoice(dockChoice);
    }
  }, [dockChoice, onConsumeDockChoice]);

  useLayoutEffect(() => {
    onDragOptionsChange(dragOptions);
    return () => {
      onDragOptionsChange(undefined);
    };
  }, [dragOptions, onDragOptionsChange]);

  const currentTask = intent === undefined ? undefined : receiving.data?.find(task => task.id === intent.taskId);
  const currentReason = intent === undefined || error !== null ? undefined : reasonByTask.get(intent.taskId);
  const snapshot = readSnapshot(currentTask, currentReason);

  return (
    <section className="flex min-w-0 flex-col gap-3" data-testid="warehouse-yard-dispatch" ref={panelRef}>
      {result !== undefined && (
        <p className="text-sm" data-testid="yard-dispatch-result" role="status">
          {t(OUTCOME_TEXT[result.outcome])}
          {result.unloadingPointId === undefined
            ? null
            : ` · ${dockCodes.get(result.unloadingPointId) ?? result.unloadingPointId.slice(-8)}`}
        </p>
      )}
      {intent !== undefined && (
        <WarehouseYardDispatchForm
          canManage={canManage}
          dockCodes={dockCodes}
          intent={intent}
          onClose={handleClose}
          onEditingChange={onEditingChange}
          onRefresh={handleReview}
          onSuccess={handleSuccess}
          snapshot={snapshot}
          t={t}
          warehouseId={warehouse.id}
        />
      )}
      {!canManage && !isReadDenied && <p className="text-sm text-on-panel-muted">{t('warehouseWork.yardDispatchReadOnly')}</p>}
      <WidgetStates
        data={groups}
        empty={<EmptyState icon={Truck} text={t('warehouseWork.yardDispatchEmpty')} />}
        error={error}
        isEmpty={current => current.queue.length + current.slots.length + current.waiting.length + current.docked.length === 0}
        isRetrying={receiving.isFetching || waiting.isFetching}
        loadingLabel={t('warehouseWork.yardDispatchLoading')}
        onRetry={handleDataRefresh}
        skeleton={<Skeleton className="h-24 w-full" />}
      >
        {current => ([
          { name: 'warehouseWork.yardDispatchQueue', visits: current.queue },
          { name: 'warehouseWork.yardDispatchReservations', visits: current.slots },
          { name: 'warehouseWork.yardDispatchWaiting', visits: current.waiting },
          { name: 'warehouseWork.yardDispatchAtDocks', visits: current.docked },
        ] as const).map(({ name, visits }) => visits.length === 0
          ? null
          : (
              <section className="flex min-w-0 flex-col gap-2" key={name}>
                <h3 className="font-semibold">{t(name)}</h3>
                <ul className="grid gap-2">
                  {visits.map(visit => (
                    <YardVisitRow
                      canManage={canManage && intent === undefined && error === null}
                      canViewDeals={canViewDeals}
                      dockCodes={dockCodes}
                      isSelected={selectedId === visit.task.id}
                      key={visit.task.id}
                      onOpen={handleOpen}
                      onSelect={handleSelect}
                      t={t}
                      timeZone={warehouse.timeZone}
                      visit={visit}
                      warehouseId={warehouse.id}
                      worldTimeMs={worldTimeMs}
                    />
                  ))}
                </ul>
              </section>
            ))}
      </WidgetStates>
    </section>
  );
};
