import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { OrganizationSideValue } from '../config/sideBadges';

import { SIDE_BADGES } from '../config/sideBadges';

const SIDE_BADGE_CLASS_NAME
  = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-current/35 px-2.5 py-0.5 text-sm leading-5 font-medium';

interface SideBadgeProps {
  side: OrganizationSideValue;
}

export const SideBadge = ({ side }: SideBadgeProps): ReactElement => {
  const { t } = useI18n();

  const { className, Icon, labelKey } = SIDE_BADGES[side];

  return (
    <span className={cn(SIDE_BADGE_CLASS_NAME, className)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      {t(labelKey)}
    </span>
  );
};
