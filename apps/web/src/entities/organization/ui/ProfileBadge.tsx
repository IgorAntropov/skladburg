import type { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import type { ReactElement } from 'react';

import { cn } from '@/shared/lib/cn';

import { toOrganizationSide } from '../config/sideBadges';
import { normalizeVerificationLevel } from '../lib/normalizeVerificationLevel';
import { SideBadge } from './SideBadge';
import { VerificationBadge } from './VerificationBadge';

interface ProfileBadgeProps {
  isCompact?: boolean | undefined;
  kind: ProfileKind;
  level: number;
}

export const ProfileBadge = ({ isCompact = false, kind, level }: ProfileBadgeProps): ReactElement | undefined => {
  const side = toOrganizationSide(kind);

  if (side === undefined) {
    return undefined;
  }

  return (
    <span
      className={cn('inline-flex items-center', isCompact ? 'gap-1' : 'flex-wrap gap-1.5')}
      data-level={normalizeVerificationLevel(level)}
      data-side={side}
      data-testid="profile-badge"
    >
      <SideBadge side={side} />
      <VerificationBadge isCompact={isCompact} level={level} />
    </span>
  );
};
