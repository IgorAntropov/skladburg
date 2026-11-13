import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { useRef } from 'react';

import { useCan } from '@/entities/session';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  ActionButton,
  Button,
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
  TextLink,
} from '@/shared/ui';

import type { DealReceiptActionValue } from '../../../lib/dealReceiptActions';
import type { DealWarehouseReceiptProps } from './dealWarehouseReceiptTypes';

import { useDealCommandAccess } from '../../../api/commands/useDealCommandAccess';
import { useDealReceiptCommand } from '../../../api/useDealReceipt';
import { getReceiptAction } from '../../../lib/dealReceiptActions';
import { dealReceiptSection } from './dealReceiptSection';
import { ReceiptLines } from './ReceiptLines';

interface ReceiptButtonProps extends Pick<DealWarehouseReceiptProps, 'deal' | 'onFocusStatus' | 'onRefresh' | 'onUpdated'> {
  action: DealReceiptActionValue;
  label: string;
  refreshLabel: string;
}

const ReceiptButton = ({ action, deal, label, onFocusStatus, onRefresh, onUpdated, refreshLabel }: ReceiptButtonProps): ReactElement => {
  const access = useDealCommandAccess(DealService.method[action]);
  const buttonRef = useRef<HTMLDivElement>(null);
  const handleUpdated: typeof onUpdated = (updated): void => {
    if (buttonRef.current?.contains(document.activeElement) === true) {
      onFocusStatus();
    }
    onUpdated(updated);
  };
  const command = useDealReceiptCommand({
    action,
    deal,
    onRefresh,
    onUpdated: handleUpdated,
  });
  const isConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;

  return (
    <div className="flex flex-wrap items-start gap-2" ref={buttonRef}>
      <ActionButton
        access={access}
        command={command}
        data-testid={action === 'openDealReceiptClaim' ? 'deal-receipt-open-claim' : 'deal-receipt-confirm'}
        isDisabled={isConflict}
      >
        {label}
      </ActionButton>
      {isConflict && <Button onClick={onRefresh} variant="secondary">{refreshLabel}</Button>}
    </div>
  );
};

export const DealWarehouseReceipt = ({
  deal,
  isOutbound,
  onFocusStatus,
  onRefresh,
  onUpdated,
  party,
  receipt,
}: DealWarehouseReceiptProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(dealReceiptSection);
  const ownWarehouseId = isOutbound ? deal.shipFromWarehouseId : deal.shipToWarehouseId;
  const canViewOwnTasks = useCan(PermissionCode.TASK_VIEW, { kind: 'warehouse', warehouseId: ownWarehouseId });
  const isArrived = deal.status === DealStatus.ARRIVED;
  const hasReceived = receipt !== undefined && receipt.lines.length > 0;
  const isWarehouseLinkShown = canViewOwnTasks && (isOutbound || (party === 'customer' && isArrived));
  const action = receipt === undefined ? undefined : getReceiptAction(deal.status, party, receipt);

  if (t === undefined) {
    return status === 'error'
      ? <ErrorNotice error={null} onRetry={retry} />
      : <SkeletonGroup isFilled label={baseText('routing.section.loading')}><Skeleton className="h-16" /></SkeletonGroup>;
  }

  const documents = [
    [receipt?.updDocumentId, 'dealReceipt.upd'],
    [receipt?.discrepancyActDocumentId, 'dealReceipt.act'],
    [receipt?.claimDocumentId, 'dealReceipt.claim'],
    [receipt?.receiptTitleDocumentId, 'dealReceipt.title'],
  ] as const;
  const heading = t(isOutbound ? 'dealReceipt.outbound' : 'dealReceipt.work');
  const receiptOutcome = receipt?.hasDiscrepancies === true ? 'dealReceipt.hasDiscrepancies' : 'dealReceipt.fullMatch';
  const stage = isOutbound
    ? 'dealReceipt.picking'
    : isArrived ? 'dealReceipt.receiving' : 'dealReceipt.waitingForArrival';
  const signature = receipt?.hasDiscrepancies === true ? 'dealReceipt.signPartial' : 'dealReceipt.sign';
  const actionLabel = action === 'openDealReceiptClaim' ? 'dealReceipt.openClaim' : signature;

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-control border border-line p-3" data-testid="deal-warehouse-receipt">
      <h3 className="text-base font-semibold">{heading}</h3>
      {hasReceived
        ? (
            <>
              <p className="text-sm font-medium">{t(receiptOutcome)}</p>
              <ReceiptLines deal={deal} lines={receipt.lines} t={t} />
            </>
          )
        : <p className="text-sm text-on-panel-muted">{t(stage)}</p>}
      {!isOutbound && (
        <div className="flex flex-wrap gap-x-4">
          {documents.map(([id, label]) => id === undefined || id === ''
            ? null
            : (
                <TextLink isFocusRequested key={id} size="sm" to={{ kind: 'object', object: { id, type: 'document' } }}>
                  {t(label)}
                </TextLink>
              ))}
        </div>
      )}
      {isWarehouseLinkShown && (
        <TextLink
          className="self-start"
          data-testid="deal-open-warehouse"
          isFocusRequested
          size="sm"
          to={{ kind: 'object', object: { id: ownWarehouseId, type: 'warehouse' } }}
        >
          {t('dealReceipt.warehouse')}
        </TextLink>
      )}
      {action !== undefined && (
        <ReceiptButton
          action={action}
          deal={deal}
          key={`${action}:${String(deal.version)}`}
          label={t(actionLabel)}
          onFocusStatus={onFocusStatus}
          onRefresh={onRefresh}
          onUpdated={onUpdated}
          refreshLabel={t('dealReceipt.refresh')}
        />
      )}
    </section>
  );
};
