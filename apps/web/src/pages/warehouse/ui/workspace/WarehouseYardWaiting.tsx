import type {
  ReceivingDockSchedule,
  YardWaitingReason,
} from '@skladburg/contracts/wms/v1/receiving';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  YardPriorityFactor,
  YardWaitingReasonCode,
} from '@skladburg/contracts/wms/v1/receiving';

import { useI18n } from '@/shared/i18n';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

interface WarehouseYardWaitingProps {
  reason: YardWaitingReason;
  schedule: ReceivingDockSchedule | undefined;
  t: WarehouseWorkTranslate;
  timeZone: string;
}

const REASON_TEXT = {
  [YardWaitingReasonCode.BOOKED_DOCK_BUSY]: 'warehouseWork.yardBookedDockBusy',
  [YardWaitingReasonCode.DOCKS_BUSY]: 'warehouseWork.yardDocksBusy',
  [YardWaitingReasonCode.NO_COMPATIBLE_DOCK]: 'warehouseWork.yardNoCompatibleDock',
  [YardWaitingReasonCode.PASS_REJECTED]: 'warehouseWork.yardPassRejected',
  [YardWaitingReasonCode.WAITING_ASSIGNMENT]: 'warehouseWork.yardWaitingAssignment',
  [YardWaitingReasonCode.WAITING_DOCUMENTS]: 'warehouseWork.yardWaitingDocuments',
} as const;

const FACTOR_TEXT = {
  [YardPriorityFactor.AVAILABLE_RESOURCES]: 'warehouseWork.yardFactorResources',
  [YardPriorityFactor.COLD_CARGO]: 'warehouseWork.yardFactorCold',
  [YardPriorityFactor.DELIVERY_WINDOW]: 'warehouseWork.yardFactorWindow',
  [YardPriorityFactor.EXPIRING_CARGO]: 'warehouseWork.yardFactorExpiry',
  [YardPriorityFactor.EXPLICIT_URGENCY]: 'warehouseWork.yardFactorExplicit',
  [YardPriorityFactor.STARTED_RECEIPT]: 'warehouseWork.yardFactorStarted',
  [YardPriorityFactor.WAITING_TIME]: 'warehouseWork.yardFactorWaiting',
} as const;

const hasKey = <T extends object>(record: T, key: PropertyKey): key is keyof T => Object.hasOwn(record, key);

export const WarehouseYardWaiting = ({ reason, schedule, t, timeZone }: WarehouseYardWaitingProps): ReactElement => {
  const { formatDateTime } = useI18n();
  const startsAt = schedule?.reservation?.startsAt;
  const code = reason.reason;
  const hasSlot = code === YardWaitingReasonCode.WAITING_SLOT && startsAt !== undefined;
  const summary = hasSlot
    ? t('warehouseWork.yardWaitingSlot', { time: formatDateTime(timestampMs(startsAt), { timeZone }) })
    : t(hasKey(REASON_TEXT, code) ? REASON_TEXT[code] : 'warehouseWork.yardWaitingAssignment');
  const hasCombinedCargo = reason.priorityFactors.includes(YardPriorityFactor.COLD_CARGO)
    && reason.priorityFactors.includes(YardPriorityFactor.EXPIRING_CARGO);
  const factors = reason.priorityFactors.filter((factor): factor is keyof typeof FACTOR_TEXT => hasKey(FACTOR_TEXT, factor)
    && !(hasCombinedCargo && factor === YardPriorityFactor.EXPIRING_CARGO));

  return (
    <div className="flex flex-col gap-1 text-sm text-on-panel-muted">
      <p aria-live="polite" data-testid="warehouse-receiving-dock">
        <span data-reason={YardWaitingReasonCode[code]} data-testid="yard-waiting-reason">{summary}</span>
      </p>
      {factors.length > 0 && (
        <details>
          <summary
            className="min-h-8 w-fit cursor-pointer content-center py-1 font-medium text-on-panel"
            data-testid="yard-priority-details"
          >
            {t('warehouseWork.yardPriorityDetails')}
          </summary>
          <ul className="list-disc space-y-1 ps-5" data-testid="yard-priority-reasons">
            {factors.map(factor => (
              <li data-factor={YardPriorityFactor[factor]} key={factor}>
                {t(hasCombinedCargo && factor === YardPriorityFactor.COLD_CARGO
                  ? 'warehouseWork.yardFactorColdAndExpiry'
                  : FACTOR_TEXT[factor])}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
