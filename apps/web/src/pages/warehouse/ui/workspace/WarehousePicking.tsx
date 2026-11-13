import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReactElement } from 'react';

import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { useState } from 'react';

import { useCommandAccess } from '@/entities/session';
import { useActingContext } from '@/shared/api';
import {
  ActionButton,
  Button,
  Card,
  TextLink,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { WarehouseScanHandlerValue } from './WarehouseScanner';

import {
  useClaimPicking,
  useConfirmPicking,
  useConfirmWarehouseShipment,
} from '../../api/useWarehouseCommands';
import { PICKING_TEXT } from './warehouseFormatting';
import { WarehouseStockLines } from './WarehouseInventory';
import { WarehouseScanner } from './WarehouseScanner';

interface WarehousePickingProps {
  canViewDeals: boolean;
  cells: ReadonlyMap<string, string>;
  onChanged: () => void;
  t: WarehouseWorkTranslate;
  task: PickingTask;
}

export const WarehousePicking = ({ canViewDeals, cells, onChanged, t, task }: WarehousePickingProps): ReactElement => {
  const { userId } = useActingContext();
  const [checked, setChecked] = useState<readonly string[]>([]);
  const claim = useClaimPicking(task, onChanged);
  const confirm = useConfirmPicking(task, checked, onChanged);
  const ship = useConfirmWarehouseShipment(task, onChanged);
  const scope = { kind: 'warehouse', warehouseId: task.warehouseId } as const;
  const claimAccess = useCommandAccess(claim.method, scope);
  const confirmAccess = useCommandAccess(confirm.method, scope);
  const shipAccess = useCommandAccess(ship.method, scope);
  const isAssigned = task.assigneeUserId === userId;
  const isOpen = task.status === PickingTaskStatus.OPEN;
  const isPicking = task.status === PickingTaskStatus.IN_PROGRESS;
  const isPicked = task.status === PickingTaskStatus.PICKED;
  const canCheck = isPicking && isAssigned && confirmAccess.status === 'allowed';
  const hasAllChecked = checked.length === task.units.length && checked.length > 0;

  const handleCheck = (handlingUnitId: string): void => {
    console.log('> WarehousePicking -> handleCheck:', { isPicking });
    confirm.reset();
    setChecked(prev => prev.includes(handlingUnitId) ? prev.filter(id => id !== handlingUnitId) : [...prev, handlingUnitId]);
  };

  const handleScan: WarehouseScanHandlerValue = (raw, { readUnit }) => {
    const sscc = readUnit(raw);
    const unit = task.units.find(balance => balance.handlingUnit?.sscc === sscc)?.handlingUnit;
    if (unit === undefined) {
      return 'warehouseWork.error.invalidCode';
    }
    if (checked.includes(unit.id)) {
      return 'warehouseWork.error.duplicate';
    }
    handleCheck(unit.id);
    return undefined;
  };

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-3" data-testid="warehouse-picking-task">
      <header className="flex flex-wrap items-center justify-between gap-x-4">
        <h3 className="font-semibold">{t('warehouseWork.picking')}</h3>
        <p className="text-sm text-on-panel-muted">{t(PICKING_TEXT[task.status])}</p>
      </header>
      {canViewDeals && (
        <TextLink size="sm" to={{ kind: 'object', object: { id: task.dealId, type: 'deal' } }}>{t('warehouseWork.deal')}</TextLink>
      )}
      {isPicking && <p aria-live="polite">{t('warehouseWork.marked', { count: checked.length, total: task.units.length })}</p>}
      {canCheck && <WarehouseScanner isReadOnly={confirm.isPending} onScan={handleScan} t={t} />}
      <ul className="divide-y divide-line">
        {task.units.map((balance) => {
          const unit = balance.handlingUnit;
          if (unit === undefined) {
            return null;
          }
          const isChecked = checked.includes(unit.id);
          const handleUnitCheck = (): void => {
            handleCheck(unit.id);
          };

          return (
            <li className="flex flex-col gap-1 py-2" key={unit.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium tabular-nums wrap-anywhere">{unit.sscc}</p>
                <p className="text-sm text-on-panel-muted">{cells.get(balance.cellId) ?? t('warehouseWork.noCell')}</p>
              </div>
              <WarehouseStockLines lines={balance.lines} t={t} />
              {canCheck && (
                <Button
                  aria-pressed={isChecked}
                  className="self-start"
                  data-testid="warehouse-pick-unit"
                  disabled={confirm.isPending}
                  onClick={handleUnitCheck}
                  variant="secondary"
                >
                  {t(isChecked ? 'warehouseWork.untake' : 'warehouseWork.take')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {!isAssigned && (isPicking || isPicked) && <p className="text-sm text-on-panel-muted">{t('warehouseWork.workByOther')}</p>}
      {isOpen && (
        <ActionButton access={claimAccess} command={claim} data-testid="warehouse-claim-picking">{t('warehouseWork.claim')}</ActionButton>
      )}
      {isAssigned && isPicking && (
        <ActionButton access={confirmAccess} command={confirm} data-testid="warehouse-confirm-picking" isDisabled={!hasAllChecked}>
          {t('warehouseWork.pick')}
        </ActionButton>
      )}
      {isAssigned && isPicked && (
        <ActionButton access={shipAccess} command={ship} data-testid="warehouse-confirm-shipment">{t('warehouseWork.ship')}</ActionButton>
      )}
    </Card>
  );
};
