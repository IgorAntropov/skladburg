import type {
  ExpectedReceivingUnit,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { MarkingMode } from '@skladburg/contracts/catalog/v1/catalog';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';
import { useState } from 'react';

import {
  useCan,
  useCommandAccess,
} from '@/entities/session';
import { useActingContext } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  AccessButton,
  ActionButton,
  Button,
  Card,
  ChunkLoadNotice,
  Skeleton,
  SkeletonGroup,
  TextLink,
  useFocusHandoff,
} from '@/shared/ui';

import type { ReceiveUnitSelectionValue } from '../../api/useReceiveUnitForm';
import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import {
  receivingMethods,
  useClaimReceiving,
  useFinishReceiving,
} from '../../api/useWarehouseCommands';
import { RECEIVING_TEXT } from './warehouseFormatting';
import { WarehousePlacement } from './WarehousePlacement';
import { WarehouseReceiptPrint } from './WarehouseReceiptPrint';

interface WarehouseReceivingProps {
  canViewDeals: boolean;
  cells: ReadonlyMap<string, string>;
  editingTaskId: string | undefined;
  onChanged: () => void;
  onEditingChange: (taskId: string | undefined) => void;
  t: WarehouseWorkTranslate;
  task: ReceivingTask;
}

const loadReceiveForm = createCachedModuleLoader(() => import('./WarehouseReceiveForm'));

export const WarehouseReceiving = ({
  canViewDeals, cells, editingTaskId, onChanged, onEditingChange, t, task,
}: WarehouseReceivingProps): ReactElement => {
  const { userId } = useActingContext();
  const { t: baseText } = useI18n();
  const [selected, setSelected] = useState<ReceiveUnitSelectionValue | undefined>();
  const [isFinishRequested, setIsFinishRequested] = useState(false);
  const { load, state } = useChunkLoader(loadReceiveForm);
  const { ref: manualButtonRef, requestFocus } = useFocusHandoff<HTMLButtonElement>('warehouse-receipt');
  const claim = useClaimReceiving(task, onChanged);
  const finish = useFinishReceiving(task, onChanged);
  const scope = { kind: 'warehouse', warehouseId: task.warehouseId } as const;
  const canViewInventory = useCan(PermissionCode.INVENTORY_VIEW, scope);
  const claimAccess = useCommandAccess(claim.method, scope);
  const receiveAccess = useCommandAccess(receivingMethods.receiveHandlingUnit, scope);
  const finishAccess = useCommandAccess(finish.method, scope);
  const isAssigned = task.assigneeUserId === userId;
  const isOpen = task.status === ReceivingTaskStatus.OPEN;
  const isReceiving = task.status === ReceivingTaskStatus.IN_PROGRESS;
  const canReceive = isAssigned && isReceiving && (editingTaskId === undefined || editingTaskId === task.id);
  const canPlace = isAssigned && !isOpen && editingTaskId === undefined;
  const receivedIds = new Set(task.receivedUnits.map(unit => unit.expectedUnitId));
  const missing = task.expectedUnits.filter(unit => !receivedIds.has(unit.id));
  const selectedUnit = task.expectedUnits.find(unit => unit.id === selected?.expectedUnitId);
  const selectedLine = task.orderLines.find(line => line.dealLineId === selectedUnit?.batches[0]?.dealLineId);
  const hasEvidence = selectedUnit?.batches.length === 1;
  const hasMarking = hasEvidence && selectedLine?.markingMode === MarkingMode.UNIT;
  const placedCount = task.receivedUnits.filter(unit => unit.putAwayCellId !== undefined).length;
  const Form = state.kind === 'loaded' ? state.module.WarehouseReceiveForm : undefined;

  const handleManual = (): void => {
    console.log('> WarehouseReceiving -> handleManual:', {});
    onEditingChange(task.id);
    setSelected({ kind: 'labelled' });
    load();
  };

  const handleSelect = (unit: ExpectedReceivingUnit): void => {
    console.log('> WarehouseReceiving -> handleSelect:', { hasLabel: unit.sscc !== undefined });
    const line = task.orderLines.find(candidate => candidate.dealLineId === unit.batches[0]?.dealLineId);
    onEditingChange(task.id);
    setSelected(unit.sscc === undefined
      ? { expectedUnitId: unit.id, gtin: line?.gtin ?? '', kind: 'unlabelled' }
      : { expectedUnitId: unit.id, kind: 'labelled' });
    load();
  };

  const handleCancel = (): void => {
    console.log('> WarehouseReceiving -> handleCancel:', {});
    setSelected(undefined);
    onEditingChange(undefined);
    requestFocus();
  };

  const handleReceived = (): void => {
    setSelected(undefined);
    onEditingChange(undefined);
    requestFocus();
    onChanged();
  };

  const handleFinishRequest = (): void => {
    console.log('> WarehouseReceiving -> handleFinishRequest:', {});
    setIsFinishRequested(true);
  };

  const handleFinishCancel = (): void => {
    console.log('> WarehouseReceiving -> handleFinishCancel:', {});
    setIsFinishRequested(false);
  };

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-3" data-testid="warehouse-receiving-task">
      <header className="flex flex-wrap items-center justify-between gap-x-4">
        <h3 className="font-semibold">{t('warehouseWork.receipt')}</h3>
        <p className="text-sm text-on-panel-muted">{t(RECEIVING_TEXT[task.status])}</p>
      </header>
      {canViewDeals && (
        <TextLink size="sm" to={{ kind: 'object', object: { id: task.dealId, type: 'deal' } }}>{t('warehouseWork.deal')}</TextLink>
      )}
      <p aria-live="polite" className="text-sm tabular-nums">
        {t('warehouseWork.received', { count: task.receivedUnits.length, total: task.expectedUnits.length })}
        {' · '}
        {t('warehouseWork.placed', { count: placedCount, total: task.receivedUnits.length })}
      </p>
      {isOpen && (
        <ActionButton access={claimAccess} command={claim} data-testid="warehouse-claim-receiving">{t('warehouseWork.claim')}</ActionButton>
      )}
      {!isAssigned && isReceiving && <p className="text-sm text-on-panel-muted">{t('warehouseWork.workByOther')}</p>}
      {canReceive && selected === undefined && (
        <>
          <AccessButton
            access={receiveAccess}
            className="self-start"
            data-testid="warehouse-enter-sscc"
            onClick={handleManual}
            ref={manualButtonRef}
          >
            {t('warehouseWork.sscc')}
          </AccessButton>
          <ul className="divide-y divide-line">
            {missing.map((unit) => {
              const unitLabel = unit.sscc ?? t('warehouseWork.noLabel');
              const handleSelectUnit = (): void => {
                handleSelect(unit);
              };

              return (
                <li className="flex flex-wrap items-center justify-between gap-2 py-2" key={unit.id}>
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums wrap-anywhere">{unitLabel}</p>
                    {unit.batches.map((batch, index) => {
                      const line = task.orderLines.find(candidate => candidate.dealLineId === batch.dealLineId);
                      return (
                        <p className="text-sm text-on-panel-muted wrap-anywhere" key={`${batch.dealLineId}:${String(index)}`}>
                          {line?.productName}
                          {' · '}
                          {t('warehouseWork.batch', { number: batch.batchNumber })}
                        </p>
                      );
                    })}
                  </div>
                  <AccessButton access={receiveAccess} data-testid="warehouse-receive-unit" onClick={handleSelectUnit} variant="secondary">
                    {t('warehouseWork.accept')}
                  </AccessButton>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {canReceive && selected !== undefined && Form !== undefined && (
        <Form
          hasEvidence={hasEvidence}
          hasMarking={hasMarking}
          key={selected.expectedUnitId ?? 'manual'}
          onCancel={handleCancel}
          onReceived={handleReceived}
          selection={selected}
          t={t}
          task={task}
        />
      )}
      {canReceive && selected !== undefined && Form === undefined && (
        <div className="flex flex-col items-start gap-2">
          {state.kind === 'failed'
            ? (
                <ChunkLoadNotice
                  message={t('warehouseWork.formError')}
                  onRetry={load}
                  recovery={state.recovery}
                  repeatedMessage={t('warehouseWork.formError')}
                />
              )
            : <SkeletonGroup isFilled label={baseText('routing.section.loading')}><Skeleton className="h-20 w-full" /></SkeletonGroup>}
          <Button onClick={handleCancel} variant="secondary">{t('warehouseWork.cancel')}</Button>
        </div>
      )}
      <ul className="divide-y divide-line">
        {task.receivedUnits.map((unit) => {
          const balance = unit.balanceAtReceipt;
          const handlingUnit = balance?.handlingUnit;
          if (balance === undefined || handlingUnit === undefined) {
            return null;
          }
          const { putAwayCellId } = unit;
          const canPlaceUnit = canPlace && putAwayCellId === undefined && cells.size > 0;

          return (
            <li className="flex flex-col gap-1.5 py-2" key={unit.expectedUnitId}>
              <p className="font-medium tabular-nums wrap-anywhere">{handlingUnit.sscc}</p>
              {putAwayCellId !== undefined && <p className="text-sm">{cells.get(putAwayCellId) ?? t('warehouseWork.cell')}</p>}
              {canViewInventory && <WarehouseReceiptPrint balance={balance} t={t} task={task} />}
              {canPlaceUnit && (
                <WarehousePlacement cells={cells} handlingUnitId={handlingUnit.id} onChanged={onChanged} t={t} task={task} />
              )}
            </li>
          );
        })}
      </ul>
      {canReceive && selected === undefined && missing.length > 0 && !isFinishRequested && (
        <AccessButton access={finishAccess} onClick={handleFinishRequest} variant="secondary">
          {t('warehouseWork.finish')}
        </AccessButton>
      )}
      {canReceive && selected === undefined && (missing.length === 0 || isFinishRequested) && (
        <div className="flex flex-col gap-2">
          {missing.length > 0 && <p className="text-sm">{t('warehouseWork.finishShort')}</p>}
          <div className="flex flex-wrap gap-2">
            <ActionButton access={finishAccess} command={finish} data-testid="warehouse-finish-receiving">
              {t('warehouseWork.finish')}
            </ActionButton>
            {isFinishRequested && <Button onClick={handleFinishCancel} variant="secondary">{t('warehouseWork.cancel')}</Button>}
          </div>
        </div>
      )}
    </Card>
  );
};
