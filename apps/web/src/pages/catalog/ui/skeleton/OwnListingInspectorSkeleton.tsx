import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

import { OwnTiersSkeleton } from './OwnTiersSkeleton';
import { OwnWarehousesSkeleton } from './OwnWarehousesSkeleton';

export const OwnListingInspectorSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-4">
    <div className="flex h-6.5 items-center">
      <Skeleton className="h-4 w-28" />
    </div>
    <Skeleton className="h-11 w-28" />
    <OwnTiersSkeleton />
    <OwnWarehousesSkeleton />
  </div>
);
