import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { useRef } from 'react';

import type { DateTimeFormatPartsValue } from '@/shared/i18n';

import {
  getOffsetLabel,
  useI18n,
} from '@/shared/i18n';
import {
  ActionButton,
  Button,
} from '@/shared/ui';

import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';
import type { DealFulfillmentActionValue } from '../../lib/dealFulfillment';
import type { DealFolderTranslate } from './dealFolderSection';

import { useDealCommandAccess } from '../../api/commands/useDealCommandAccess';
import {
  dealFulfillmentMethods,
  useDealFulfillment,
} from '../../api/commands/useDealFulfillment';

const DEADLINE_FORMAT: DateTimeFormatPartsValue = { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'long' };

interface DealFulfillmentButtonProps extends DealCommandContextValue {
  action: DealFulfillmentActionValue;
  onFocusStatus: () => void;
  t: DealFolderTranslate;
}

export const DealFulfillmentButton = ({
  action,
  deal,
  onFocusStatus,
  onRefresh,
  onUpdated,
  t,
}: DealFulfillmentButtonProps): ReactElement => {
  const { formatDateTime, userTimeZone } = useI18n();
  const access = useDealCommandAccess(dealFulfillmentMethods[action]);
  const buttonRef = useRef<HTMLDivElement>(null);
  const isAcceptance = action === 'acceptDeal';
  const dueAt = isAcceptance ? deal.deadlines?.acceptanceDueAt : undefined;
  const deadlineMs = dueAt === undefined ? undefined : timestampMs(dueAt);
  const deadlineZone = deal.deadlines?.timeZone;
  const timeZone = deadlineZone === undefined || deadlineZone === '' ? userTimeZone : deadlineZone;
  const offset = deadlineMs === undefined ? undefined : getOffsetLabel(timeZone, deadlineMs);
  const deadlineText = deadlineMs === undefined
    ? undefined
    : formatDateTime(deadlineMs, { format: DEADLINE_FORMAT, placeName: t('dealFolder.warehouseTime'), timeZone });
  const isLocalOffset = deadlineMs !== undefined && offset === getOffsetLabel(userTimeZone, deadlineMs);

  const handleUpdated = (updated: Deal): void => {
    if (updated.status !== deal.status && buttonRef.current?.contains(document.activeElement) === true) {
      onFocusStatus();
    }
    onUpdated(updated);
  };
  const command = useDealFulfillment({ action, deal, onRefresh, onUpdated: handleUpdated });
  const isConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;

  return (
    <div className="flex min-w-0 flex-col gap-2" ref={buttonRef}>
      {deadlineMs !== undefined && deadlineText !== undefined && (
        <time
          className="text-sm text-on-panel-muted"
          data-testid="deal-acceptance-due"
          dateTime={new Date(deadlineMs).toISOString()}
        >
          {isLocalOffset
            ? t('dealFolder.acceptanceDueLocal', { offset, time: deadlineText })
            : t('dealFolder.acceptanceDue', { time: deadlineText })}
        </time>
      )}
      <ActionButton
        access={access}
        command={command}
        data-testid={isAcceptance ? 'deal-accept' : 'deal-mark-shipped'}
        isDisabled={isConflict}
      >
        {t(isAcceptance ? 'dealFolder.accept' : 'dealFolder.markShipped')}
      </ActionButton>
      {isConflict && <Button className="self-start" onClick={onRefresh} variant="secondary">{t('dealFolder.refresh')}</Button>}
    </div>
  );
};
