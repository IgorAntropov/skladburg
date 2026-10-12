import type { ReactElement } from 'react';

import type { AppAddressValue } from '@/shared/routing';
import type { SkeletonTimingValue } from '@/shared/ui';

import { TopBarSkeleton } from '@/widgets/top-bar';

import { getSkeletonZones } from '../routing/sectionSkeletonZones';
import { SessionPendingScreen } from '../routing/SessionPendingScreen';

interface ShellSkeletonProps {
  address: AppAddressValue | undefined;
  timing?: SkeletonTimingValue | undefined;
}

export const ShellSkeleton = ({ address, timing }: ShellSkeletonProps): ReactElement => {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-on-canvas">
      <TopBarSkeleton />
      <SessionPendingScreen timing={timing} zones={getSkeletonZones(address)} />
    </div>
  );
};
