import type { Money } from '@skladburg/contracts/common/v1/money';
import type { SafeDealPayment } from '@skladburg/contracts/payment/v1/payment';
import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { useRef } from 'react';

import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import {
  ActionButton,
  Button,
} from '@/shared/ui';

import type { DealFolderTranslate } from './dealFolderSection';

import { useDealApprovalAccess } from '../../api/commands/useDealCommandAccess';
import {
  fundDealMethod,
  useFundDeal,
} from '../../api/useDealPayment';

interface FundDealButtonProps {
  amount: Money;
  onFunded: () => void;
  onRefresh: () => void;
  payment: SafeDealPayment;
  t: DealFolderTranslate;
}

export const FundDealButton = ({ amount, onFunded, onRefresh, payment, t }: FundDealButtonProps): ReactElement => {
  const { locale } = useI18n();
  const { access, limit } = useDealApprovalAccess(fundDealMethod, amount, 'payment_fund');
  const buttonRef = useRef<HTMLDivElement>(null);
  const handleFunded = (): void => {
    if (buttonRef.current?.contains(document.activeElement) === true) {
      onFunded();
    }
  };
  const command = useFundDeal({ amount, onFunded: handleFunded, onRefresh, payment });
  const isConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;

  return (
    <div className="flex flex-col gap-2" ref={buttonRef}>
      <ActionButton access={access} command={command} data-testid="deal-fund" isDisabled={isConflict || limit !== undefined}>
        {t('dealFolder.fund')}
      </ActionButton>
      {limit !== undefined && (
        <p className="text-sm text-on-panel-muted">
          {t(limit.currencyCode === amount.currencyCode ? 'dealFolder.limit' : 'dealFolder.limitCurrency', {
            amount: formatMoney(locale, amount),
            limit: formatMoney(locale, limit),
          })}
        </p>
      )}
      {isConflict && <Button className="self-start" onClick={onRefresh} variant="secondary">{t('dealFolder.refresh')}</Button>}
    </div>
  );
};
