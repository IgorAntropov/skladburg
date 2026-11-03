import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const TIER_ROW_IDS = ['first', 'second', 'third'] as const;

export const OwnTiersSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-1">
    <div className="flex h-6 items-center">
      <Skeleton className="h-4 w-32" />
    </div>
    {TIER_ROW_IDS.map(rowId => <Skeleton className="h-10 w-full" key={rowId} />)}
  </div>
);
