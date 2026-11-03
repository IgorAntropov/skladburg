import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const SKELETON_ROW_IDS = ['first', 'second', 'third'] as const;

export const OwnListSkeleton = (): ReactElement => (
  <div className="@container flex flex-col gap-2">
    {SKELETON_ROW_IDS.map(rowId => (
      <div
        className="flex min-h-26 flex-col gap-2 rounded-control border border-line px-3 py-2 @lg:flex-row @lg:gap-4"
        key={rowId}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-[55%]" />
          <Skeleton className="h-6.5 w-28" shape="circle" />
          <Skeleton className="h-4 w-[50%]" />
        </div>
        <div className="flex flex-col gap-1 border-t border-line pt-2 @lg:w-36 @lg:items-end @lg:border-t-0 @lg:pt-0">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-26" />
        </div>
      </div>
    ))}
  </div>
);
