import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  Check,
  Circle,
  CircleDot,
} from 'lucide-react';

import { cn } from '@/shared/lib/cn';

import type {
  DealsMessageKeyValue,
  DealsTranslate,
} from '../i18n/dealsSection';

interface DealTrackerProps {
  deal: Deal;
  t: DealsTranslate;
}

const TRACKER_STEPS = [
  'deals.tracker.order',
  'deals.tracker.agreement',
  'deals.tracker.payment',
  'deals.tracker.shipping',
  'deals.tracker.transit',
  'deals.tracker.acceptance',
  'deals.tracker.settlement',
] as const satisfies readonly DealsMessageKeyValue[];

const STATUS_STEPS = {
  [DealStatus.ACCEPTED]: 6,
  [DealStatus.ACCEPTING]: 5,
  [DealStatus.AGREED]: 2,
  [DealStatus.ARRIVED]: 5,
  [DealStatus.AWAITING_LOGISTICS]: 2,
  [DealStatus.AWAITING_PAYMENT]: 2,
  [DealStatus.CANCELLED]: 0,
  [DealStatus.CLAIM]: 5,
  [DealStatus.CLOSED]: TRACKER_STEPS.length,
  [DealStatus.COUNTER_OFFERED]: 1,
  [DealStatus.DOCUMENTS_CONFIRMED]: 2,
  [DealStatus.DRAFT]: 0,
  [DealStatus.IN_TRANSIT]: 4,
  [DealStatus.LOGISTICS_CHOSEN]: 2,
  [DealStatus.PAID]: 3,
  [DealStatus.PICKING]: 3,
  [DealStatus.REJECTED]: 1,
  [DealStatus.SETTLEMENT]: 6,
  [DealStatus.SHIPPED]: 4,
  [DealStatus.SUBMITTED]: 1,
  [DealStatus.UNSPECIFIED]: 0,
} satisfies Record<DealStatus, number>;

export const DealTracker = ({ deal, t }: DealTrackerProps): ReactElement => {
  const { status, transitions } = deal;
  const isStopped = status === DealStatus.CANCELLED || status === DealStatus.REJECTED;
  const currentStatus = isStopped ? transitions.at(-1)?.from ?? status : status;
  const currentStep = STATUS_STEPS[currentStatus];

  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2" data-testid="deal-tracker">
      {TRACKER_STEPS.map((step, index) => {
        const isDone = index < currentStep;
        const isCurrent = !isStopped && index === currentStep;
        const Icon = isDone ? Check : isCurrent ? CircleDot : Circle;

        return (
          <li
            aria-current={isCurrent ? 'step' : undefined}
            className={cn('inline-flex items-center gap-1.5 text-sm', isCurrent ? 'font-semibold' : 'text-on-panel-muted')}
            key={step}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {isDone && <span className="sr-only">{t('deals.tracker.done')}</span>}
            {t(step)}
          </li>
        );
      })}
    </ol>
  );
};
