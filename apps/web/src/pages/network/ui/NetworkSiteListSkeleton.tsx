import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const SKELETON_ROW_IDS = ['first', 'second', 'third', 'fourth'] as const;

export const NetworkSiteListSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-2">
    {SKELETON_ROW_IDS.map(rowId => (
      <div className="flex h-18 flex-col gap-1 rounded-control border border-line px-3 py-2" key={rowId}>
        <div className="flex h-6 items-center">
          <Skeleton className="h-4 w-2/5" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6.5 w-28" shape="circle" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    ))}
  </div>
);
