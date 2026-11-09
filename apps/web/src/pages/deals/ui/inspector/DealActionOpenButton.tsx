import type { ReactElement } from 'react';

import { DealService } from '@skladburg/contracts/deal/v1/deal';

import { AccessButton } from '@/shared/ui';

import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';
import type { DealInspectorTranslate } from '../../i18n/inspectorSection';
import type { DealEditorValue } from './dealInspectorTypes';

import { useDealApprovalAccess } from '../../api/commands/useDealCommandAccess';
import { DealLimitReason } from './DealLimitReason';

const EDITORS = {
  cancel: { label: 'dealInspector.cancel', method: DealService.method.cancelDeal, testId: 'deal-cancel' },
  confirm: { label: 'dealInspector.confirm', method: DealService.method.confirmDeal, testId: 'deal-confirm' },
  counter: { label: 'dealInspector.counter', method: DealService.method.counterDeal, testId: 'deal-counter-open' },
  delivery: { label: 'dealInspector.deliverySave', method: DealService.method.chooseDelivery, testId: 'deal-delivery-open' },
  draft: { label: 'dealInspector.edit', method: DealService.method.updateDealDraft, testId: 'deal-draft-edit' },
  reject: { label: 'dealInspector.reject', method: DealService.method.rejectDeal, testId: undefined },
  rejectOffer: { label: 'dealInspector.rejectOffer', method: DealService.method.rejectCounterOffer, testId: undefined },
} as const;

interface DealActionOpenButtonProps extends Pick<DealCommandContextValue, 'deal'> {
  action: DealEditorValue;
  onOpen: (action: DealEditorValue) => void;
  t: DealInspectorTranslate;
}

export const DealActionOpenButton = ({ action, deal, onOpen, t }: DealActionOpenButtonProps): ReactElement => {
  const { label, method, testId } = EDITORS[action];
  const amount = action === 'confirm' ? deal.goodsTotal : undefined;
  const { access, limit } = useDealApprovalAccess(method, amount);
  const isDisabled = limit !== undefined || (action === 'confirm' && amount === undefined);

  const handleOpen = (): void => {
    onOpen(action);
  };

  return (
    <div className="flex flex-col gap-2">
      <AccessButton
        access={access}
        data-deal-action={action}
        data-testid={testId}
        isDisabled={isDisabled}
        onClick={handleOpen}
        variant={action === 'confirm' ? 'primary' : 'secondary'}
      >
        {t(label)}
      </AccessButton>
      <DealLimitReason amount={amount} limit={limit} t={t} />
    </div>
  );
};
