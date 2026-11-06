import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/money';
import { AddressLink } from '@/shared/routing';

import type { DealsTranslate } from '../i18n/dealsSection';

import { isOrganizationTurn } from '../lib/groupDeals';
import { DealStatusBadge } from './DealStatusBadge';

interface DealRowProps {
  counterpartyName: string | undefined;
  deal: Deal;
  isSelected: boolean;
  organizationId: string;
  t: DealsTranslate;
}

const ROW_CLASS_NAME = [
  'grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-control border border-line px-3 py-2.5',
  'bg-panel-solid hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
].join(' ');

export const DealRow = ({ counterpartyName, deal, isSelected, organizationId, t }: DealRowProps): ReactElement => {
  const { formatDateTime, locale, t: mainT, userTimeZone } = useI18n();

  const { deadlines, goodsTotal, id, lines, number, status } = deal;
  const isOurTurn = isOrganizationTurn(deal, organizationId);
  const deadline = status === DealStatus.COUNTER_OFFERED ? deadlines?.counterOfferDueAt : deadlines?.confirmationDueAt;
  const firstProduct = lines[0]?.productSnapshot?.name;
  const products = firstProduct === undefined || lines.length <= 1
    ? firstProduct
    : t('deals.products.more', { count: lines.length - 1, name: firstProduct });
  const amount = goodsTotal === undefined ? undefined : formatMoney(locale, goodsTotal);
  const nextAction = isOurTurn ? t('deals.next.ours') : t('deals.next.counterparty');
  const shouldShowNextAction = isOurTurn || status === DealStatus.SUBMITTED || status === DealStatus.COUNTER_OFFERED;
  const deadlineTimeZone = deadlines?.timeZone;
  const deadlineLabel = deadline === undefined
    ? undefined
    : t('deals.next.deadline', {
        date: formatDateTime(timestampMs(deadline), {
          format: { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' },
          timeZone: deadlineTimeZone === '' ? userTimeZone : deadlineTimeZone ?? userTimeZone,
        }),
      });

  return (
    <li>
      <AddressLink
        aria-current={isSelected ? 'page' : undefined}
        className={cn(ROW_CLASS_NAME, isSelected && 'ring-2 ring-inset ring-focus')}
        data-testid="deal-row"
        to={{ kind: 'object', object: { id, type: 'deal' } }}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-link">{t('deals.number', { number })}</span>
          <span className="block wrap-break-word font-semibold" translate="no">{products}</span>
          <span className="block wrap-break-word text-sm text-on-panel-muted">
            {counterpartyName ?? mainT(deal.customerOrganizationId === organizationId ? 'side.supplier' : 'side.customer')}
          </span>
        </span>
        <span className="flex min-w-0 flex-col items-end gap-1 text-end">
          <DealStatusBadge status={status} />
          {amount !== undefined && <span className="font-semibold tabular-nums">{amount}</span>}
        </span>
        {shouldShowNextAction && <span className="col-span-full text-sm text-on-panel-muted">{nextAction}</span>}
        {deadlineLabel !== undefined && <span className="col-span-full text-sm text-on-panel-muted">{deadlineLabel}</span>}
      </AddressLink>
    </li>
  );
};
