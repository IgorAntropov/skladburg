import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { useRef } from 'react';

import {
  ActionButton,
  Button,
} from '@/shared/ui';

import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';
import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

import { useApproveDeal } from '../../api/commands/useApproveDeal';
import { useDealApprovalAccess } from '../../api/commands/useDealCommandAccess';
import { DealLimitReason } from './DealLimitReason';

interface ApproveDealButtonProps extends DealCommandContextValue {
  kind: 'acceptCounterOffer' | 'submitDeal';
  onRequestStatusFocus: () => void;
  t: DealInspectorTranslate;
}

export const ApproveDealButton = ({ deal, kind, onRefresh, onRequestStatusFocus, onUpdated, t }: ApproveDealButtonProps): ReactElement => {
  const isAcceptance = kind === 'acceptCounterOffer';
  const amount = isAcceptance ? deal.counterOffer?.goodsTotal : deal.goodsTotal;
  const { access, limit } = useDealApprovalAccess(DealService.method[kind], amount);
  const actionRef = useRef<HTMLDivElement>(null);
  const handleUpdated = (updated: Deal): void => {
    if (updated.status !== deal.status && actionRef.current?.contains(document.activeElement) === true) {
      onRequestStatusFocus();
    }

    onUpdated(updated);
  };
  const command = useApproveDeal({ amount, deal, kind, onRefresh, onUpdated: handleUpdated });
  const isConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;

  return (
    <div className="flex flex-col gap-2" ref={actionRef}>
      <ActionButton
        access={access}
        command={command}
        data-testid={isAcceptance ? 'deal-counter-accept' : 'deal-submit'}
        isDisabled={amount === undefined || limit !== undefined || isConflict}
      >
        {t(isAcceptance ? 'dealInspector.acceptOffer' : 'dealInspector.submit')}
      </ActionButton>
      {isConflict && (
        <Button className="self-start" onClick={onRefresh} variant="secondary">{t('dealInspector.refresh')}</Button>
      )}
      <DealLimitReason amount={amount} limit={limit} t={t} />
    </div>
  );
};
