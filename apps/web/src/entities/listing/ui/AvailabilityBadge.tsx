import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import {
  CircleAlert,
  CircleCheck,
  Clock,
} from 'lucide-react';

import { useCatalogSection } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { listingSection } from '../i18n/listingSection';

interface AvailabilityBadgeProps {
  status: AvailabilityStatus;
}

type AvailabilityLabelKeyValue = 'listing.availability.inStock' | 'listing.availability.low' | 'listing.availability.onOrder';

interface AvailabilityViewValue {
  className: string;
  Icon: LucideIcon;
  labelKey: AvailabilityLabelKeyValue;
}

const BASE_CLASS_NAME = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm leading-5 font-medium whitespace-nowrap';

const AVAILABILITY_VIEWS: Readonly<Partial<Record<AvailabilityStatus, AvailabilityViewValue>>> = {
  [AvailabilityStatus.IN_STOCK]: {
    className: 'border-transparent bg-status-ok text-on-status-ok',
    Icon: CircleCheck,
    labelKey: 'listing.availability.inStock',
  },
  [AvailabilityStatus.LOW]: {
    className: 'border-transparent bg-status-warning text-on-status-warning',
    Icon: CircleAlert,
    labelKey: 'listing.availability.low',
  },
  [AvailabilityStatus.ON_ORDER]: {
    className: 'border-line-strong text-on-panel',
    Icon: Clock,
    labelKey: 'listing.availability.onOrder',
  },
};

export const AvailabilityBadge = ({ status }: AvailabilityBadgeProps): ReactElement | undefined => {
  const { t } = useCatalogSection(listingSection);

  const view = AVAILABILITY_VIEWS[status];

  if (view === undefined || t === undefined) {
    return undefined;
  }

  return (
    <span className={cn(BASE_CLASS_NAME, view.className)} data-status={AvailabilityStatus[status]}>
      <view.Icon aria-hidden className="size-4 shrink-0" />
      {t(view.labelKey)}
    </span>
  );
};
