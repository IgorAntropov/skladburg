import type { Money } from '@skladburg/contracts/common/v1/money';
import type { SafeDealPayment } from '@skladburg/contracts/payment/v1/payment';
import type {
  ReactElement,
  ReactNode,
  Ref,
} from 'react';

import {
  PayoutStatus,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  Banknote,
  Check,
  LockKeyhole,
} from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/money';

import type { DealFolderTranslate } from './dealFolderSection';

const STATUS_KEYS = {
  [SafeDealPaymentStatus.AWAITING_FUNDS]: 'dealFolder.awaitingFunds',
  [SafeDealPaymentStatus.BLOCKED]: 'dealFolder.blocked',
  [SafeDealPaymentStatus.CLOSED]: 'dealFolder.closed',
  [SafeDealPaymentStatus.DISPUTE]: 'dealFolder.dispute',
  [SafeDealPaymentStatus.HELD]: 'dealFolder.held',
  [SafeDealPaymentStatus.INVOICED]: 'dealFolder.invoiced',
  [SafeDealPaymentStatus.PAID_OUT]: 'dealFolder.paidOut',
  [SafeDealPaymentStatus.REFUNDED]: 'dealFolder.refunded',
  [SafeDealPaymentStatus.TO_PAYOUT]: 'dealFolder.toPayout',
  [SafeDealPaymentStatus.UNSPECIFIED]: 'dealFolder.unknown',
} as const satisfies Record<SafeDealPaymentStatus, Parameters<DealFolderTranslate>[0]>;

const PROGRESS: Partial<Record<SafeDealPaymentStatus, number>> = {
  [SafeDealPaymentStatus.AWAITING_FUNDS]: 1,
  [SafeDealPaymentStatus.BLOCKED]: 2,
  [SafeDealPaymentStatus.CLOSED]: 4,
  [SafeDealPaymentStatus.HELD]: 2,
  [SafeDealPaymentStatus.INVOICED]: 0,
  [SafeDealPaymentStatus.PAID_OUT]: 4,
  [SafeDealPaymentStatus.TO_PAYOUT]: 3,
};

const PROGRESS_STEPS = [0, 1, 2, 3, 4] as const;

interface PaymentFactProps {
  label: string;
  testId?: string | undefined;
  value: string;
}

const PaymentFact = ({ label, testId, value }: PaymentFactProps): ReactElement => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-3 wrap-break-word">
    <dt className="text-on-panel-muted">{label}</dt>
    <dd className="font-medium tabular-nums" data-testid={testId}>{value}</dd>
  </div>
);

interface DealPaymentReceiptProps {
  children: ReactNode;
  payment: SafeDealPayment;
  statusRef: Ref<HTMLParagraphElement>;
  t: DealFolderTranslate;
  total: Money | undefined;
}

export const DealPaymentReceipt = ({ children, payment, statusRef, t, total }: DealPaymentReceiptProps): ReactElement => {
  const { locale } = useI18n();
  const { commissionAmount, deliveryAmount, goodsAmount, partialReceipt, payouts, status, transport } = payment;
  const rateFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, style: 'percent' });
  const rate = rateFormat.format(payment.commissionRateBasisPoints / 10_000);
  const delivery = transport?.shippingAmount ?? deliveryAmount;
  const carrierPayout = transport?.carrierPayout;
  const supplierPayouts = payouts.filter(payout => payout.organizationId !== carrierPayout?.organizationId);
  const step = PROGRESS[status];
  const appliedCommission = partialReceipt?.acceptedGoodsCommission ?? commissionAmount;
  const deliveryCommission = partialReceipt === undefined ? transport?.commissionAmount : undefined;
  const isHeld = status === SafeDealPaymentStatus.BLOCKED || status === SafeDealPaymentStatus.HELD;
  const isSettled = status === SafeDealPaymentStatus.CLOSED || status === SafeDealPaymentStatus.PAID_OUT;
  const StatusIcon = isHeld ? LockKeyhole : (isSettled ? Check : Banknote);

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-control border border-line p-3" data-status={status} data-testid="deal-payment">
      <p className="flex items-center gap-2 text-sm font-semibold" ref={statusRef} role="status" tabIndex={-1}>
        <StatusIcon aria-hidden className="size-4 shrink-0" />
        {t(STATUS_KEYS[status])}
      </p>
      {step !== undefined && (
        <div aria-hidden className="grid grid-cols-5 gap-1">
          {PROGRESS_STEPS.map(index => (
            <span className={cn('h-1 rounded-full', index <= step ? 'bg-link' : 'bg-line')} key={index} />
          ))}
        </div>
      )}
      <dl className="flex flex-col gap-1 text-sm">
        {goodsAmount !== undefined && <PaymentFact label={t('dealFolder.goods')} value={formatMoney(locale, goodsAmount)} />}
        {delivery !== undefined && <PaymentFact label={t('dealFolder.delivery')} value={formatMoney(locale, delivery)} />}
        {total !== undefined && <PaymentFact label={t('dealFolder.total')} value={formatMoney(locale, total)} />}
        {appliedCommission !== undefined && (
          <PaymentFact
            label={t('dealFolder.commission', { rate })}
            testId="deal-payment-commission"
            value={formatMoney(locale, appliedCommission)}
          />
        )}
        {deliveryCommission !== undefined && transport !== undefined && (
          <PaymentFact
            label={t('dealFolder.transportCommission', { rate: rateFormat.format(transport.commissionRateBasisPoints / 10_000) })}
            testId="deal-payment-transport-commission"
            value={formatMoney(locale, deliveryCommission)}
          />
        )}
        {partialReceipt?.acceptedGoodsAmount !== undefined && (
          <PaymentFact label={t('dealFolder.acceptedGoods')} value={formatMoney(locale, partialReceipt.acceptedGoodsAmount)} />
        )}
        {partialReceipt?.disputedGoodsAmount !== undefined && (
          <PaymentFact label={t('dealFolder.disputedGoods')} value={formatMoney(locale, partialReceipt.disputedGoodsAmount)} />
        )}
        {partialReceipt?.heldTransportAmount !== undefined && partialReceipt.heldTransportAmount.amountMinor > 0n && (
          <PaymentFact label={t('dealFolder.heldDelivery')} value={formatMoney(locale, partialReceipt.heldTransportAmount)} />
        )}
        {supplierPayouts.map(payout => payout.amount === undefined
          ? null
          : (
              <PaymentFact
                key={payout.organizationId}
                label={t(payout.status === PayoutStatus.PAID ? 'dealFolder.payout' : 'dealFolder.pendingPayout')}
                testId="deal-payment-payout"
                value={formatMoney(locale, payout.amount)}
              />
            ))}
        {carrierPayout?.amount !== undefined && (
          <PaymentFact
            label={t(carrierPayout.status === PayoutStatus.PAID ? 'dealFolder.carrierPayout' : 'dealFolder.pendingCarrierPayout')}
            testId="deal-payment-carrier-payout"
            value={formatMoney(locale, carrierPayout.amount)}
          />
        )}
      </dl>
      {appliedCommission !== undefined && (
        <p className="text-sm text-on-panel-muted">
          {t(deliveryCommission === undefined ? 'dealFolder.commissionHint' : 'dealFolder.transportCommissionHint')}
        </p>
      )}
      {children}
    </div>
  );
};
