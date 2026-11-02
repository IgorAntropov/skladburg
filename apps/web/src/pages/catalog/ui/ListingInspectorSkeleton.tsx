import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const TIER_ROW_IDS = ['first', 'second', 'third'] as const;

const CITY_ROW_IDS = ['first', 'second'] as const;

export const ListingInspectorSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-4">
    <div className="flex h-6.5 items-center">
      <Skeleton className="h-4 w-28" />
    </div>
    <div className="flex flex-col">
      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-20" />
      </div>
      <div className="flex h-11 items-center">
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="mt-2 h-6.5 w-50" shape="circle" />
    </div>
    <div className="h-58 rounded-control border border-line" />
    <div className="flex flex-col gap-1">
      <div className="flex h-6 items-center">
        <Skeleton className="h-4 w-32" />
      </div>
      {TIER_ROW_IDS.map(rowId => <Skeleton className="h-10 w-full" key={rowId} />)}
    </div>
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        <div className="flex h-6 items-center">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-52" />
        </div>
      </div>
      {CITY_ROW_IDS.map(rowId => <Skeleton className="h-25 w-full" key={rowId} />)}
    </div>
  </div>
);
