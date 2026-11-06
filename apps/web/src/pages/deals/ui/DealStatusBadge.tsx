import type { ReactElement } from 'react';

import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  CircleCheck,
  CircleDot,
  CircleX,
  ClipboardList,
  TriangleAlert,
} from 'lucide-react';

import { useCatalogSection } from '@/shared/i18n';

import { dealsSection } from '../i18n/dealsSection';
import { DEAL_STATUS_KEYS } from '../lib/dealStatus';

interface DealStatusBadgeProps {
  status: DealStatus;
}

const STATUS_CLASS_NAME = 'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold';

const STATUS_VARIANTS = {
  active: { className: 'bg-hover text-on-panel', icon: CircleDot },
  attention: { className: 'bg-status-warning text-on-status-warning', icon: TriangleAlert },
  closed: { className: 'bg-hover text-on-panel-muted', icon: CircleX },
  done: { className: 'bg-status-ok text-on-status-ok', icon: CircleCheck },
  draft: { className: 'bg-hover text-on-panel-muted', icon: ClipboardList },
};

const getStatusVariant = (status: DealStatus): keyof typeof STATUS_VARIANTS => {
  switch (status) {
    case DealStatus.AGREED:
    case DealStatus.CLOSED:
      return 'done';
    case DealStatus.CANCELLED:
    case DealStatus.REJECTED:
      return 'closed';
    case DealStatus.CLAIM:
    case DealStatus.COUNTER_OFFERED:
      return 'attention';
    case DealStatus.DRAFT:
      return 'draft';
    default:
      return 'active';
  }
};

export const DealStatusBadge = ({ status }: DealStatusBadgeProps): null | ReactElement => {
  const { t } = useCatalogSection(dealsSection);
  const { className, icon: Icon } = STATUS_VARIANTS[getStatusVariant(status)];

  return t === undefined
    ? null
    : (
        <span className={`${STATUS_CLASS_NAME} ${className}`}>
          <Icon aria-hidden className="size-4 shrink-0" />
          {t(DEAL_STATUS_KEYS[status])}
        </span>
      );
};
