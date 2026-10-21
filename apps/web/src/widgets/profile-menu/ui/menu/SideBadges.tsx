import type { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import type { ReactElement } from 'react';

import {
  SIDE_BADGES,
  toOrganizationSide,
} from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

const SIDE_BADGE_CLASS_NAME
  = 'inline-flex items-center gap-1.5 rounded-full border border-current/35 px-2.5 py-0.5 text-sm leading-5 font-medium';

interface SideBadgesProps {
  sides: readonly ProfileKind[];
}

export const SideBadges = ({ sides }: SideBadgesProps): null | ReactElement => {
  const { t } = useI18n();

  const knownSides = [...new Set(sides.map(toOrganizationSide))].filter(side => side !== undefined);

  if (knownSides.length === 0) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap justify-start gap-2">
      {knownSides.map((side) => {
        const { className, Icon, labelKey } = SIDE_BADGES[side];

        return (
          <span className={cn(SIDE_BADGE_CLASS_NAME, className)} key={side}>
            <Icon aria-hidden className="size-4 shrink-0" />
            {t(labelKey)}
          </span>
        );
      })}
    </div>
  );
};
