import type { Money } from '@skladburg/contracts/common/v1/money';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { SafeDealPayment } from '@skladburg/contracts/payment/v1/payment';
import type { ReactElement } from 'react';

import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';
import { useRef } from 'react';

import {
  isReadAccessDenied,
  useActingContext,
} from '@/shared/api';
import {
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { DealFolderTranslate } from './dealFolderSection';

import { useDealCommandAccess } from '../../api/commands/useDealCommandAccess';
import {
  getDealPaymentMethod,
  useDealPayment,
} from '../../api/useDealPayment';
import { isSupportedDealDelivery } from '../../lib/dealFulfillment';
import { DealPaymentReceipt } from './DealPaymentReceipt';
import { FundDealButton } from './FundDealButton';

interface DealPaymentProps {
  deal: Deal;
  t: DealFolderTranslate;
}

const getInvoiceTotal = ({ deliveryAmount, goodsAmount }: SafeDealPayment): Money | undefined =>
  goodsAmount !== undefined && deliveryAmount?.currencyCode === goodsAmount.currencyCode
    ? { ...goodsAmount, amountMinor: goodsAmount.amountMinor + deliveryAmount.amountMinor }
    : undefined;

export const DealPayment = ({ deal, t }: DealPaymentProps): null | ReactElement => {
  const { organizationId } = useActingContext();
  const access = useDealCommandAccess(getDealPaymentMethod);
  const canView = access.status === 'allowed';
  const query = useDealPayment(deal.id, canView);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const isUnavailable = isReadAccessDenied(query.error);
  const canFundDeal = deal.status === DealStatus.AWAITING_PAYMENT
    && deal.customerOrganizationId === organizationId
    && isSupportedDealDelivery(deal.deliveryMethod);
  const hasNoCancelledPayment = deal.status === DealStatus.CANCELLED && query.data !== undefined && query.data.payment === undefined;

  const handleRefresh = (): void => {
    void query.refetch();
  };
  const handleFunded = (): void => {
    statusRef.current?.focus();
  };

  if (!canView || isUnavailable || hasNoCancelledPayment) {
    return null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-base font-semibold">{t('dealFolder.payment')}</h3>
      <WidgetStates
        data={query.data}
        error={query.error}
        isRetrying={query.isFetching}
        loadingLabel={t('dealFolder.payment')}
        onRetry={handleRefresh}
        skeleton={<Skeleton className="h-24" />}
      >
        {({ payment }) => {
          if (payment === undefined) {
            return <p className="text-sm text-on-panel-muted">{t('dealFolder.waitingForInvoice')}</p>;
          }

          const total = payment.fundedAmount ?? (deal.deliveryMethod === DeliveryMethod.EXCHANGE ? undefined : getInvoiceTotal(payment));
          const isFundShown = canFundDeal && payment.status === SafeDealPaymentStatus.INVOICED && total !== undefined;

          return (
            <DealPaymentReceipt payment={payment} statusRef={statusRef} t={t} total={total}>
              {isFundShown && (
                <FundDealButton
                  amount={total}
                  key={payment.version}
                  onFunded={handleFunded}
                  onRefresh={handleRefresh}
                  payment={payment}
                  t={t}
                />
              )}
            </DealPaymentReceipt>
          );
        }}
      </WidgetStates>
    </section>
  );
};
