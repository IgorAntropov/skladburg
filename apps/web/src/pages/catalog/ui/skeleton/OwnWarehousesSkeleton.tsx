import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const WAREHOUSE_ROW_IDS = ['first', 'second'] as const;

export const OwnWarehousesSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-2">
    <div className="flex h-6 items-center">
      <Skeleton className="h-4 w-36" />
    </div>
    {WAREHOUSE_ROW_IDS.map(rowId => <Skeleton className="h-20 w-full" key={rowId} />)}
  </div>
);
