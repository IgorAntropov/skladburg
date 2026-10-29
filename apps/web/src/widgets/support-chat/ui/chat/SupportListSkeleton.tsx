import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

export const SupportListSkeleton = (): ReactElement => {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-28" />
      <div className="flex h-28 flex-col justify-center gap-2 rounded-control border border-line p-3">
        <Skeleton className="h-5 w-[60%]" />
        <Skeleton className="h-4 w-[45%]" />
        <Skeleton className="h-4 w-[35%]" />
      </div>
    </div>
  );
};
