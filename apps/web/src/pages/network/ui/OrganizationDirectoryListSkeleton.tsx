import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const SKELETON_ROW_IDS = ['first', 'second', 'third'] as const;

export const OrganizationDirectoryListSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-2">
    {SKELETON_ROW_IDS.map(rowId => (
      <div className="flex h-30 flex-col gap-1 rounded-control border border-line px-3 py-2" key={rowId}>
        <div className="flex h-6 items-center">
          <Skeleton className="h-4 w-[45%]" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-6.5 w-28" shape="circle" />
          <Skeleton className="size-6.5" shape="circle" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
    ))}
  </div>
);
