import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

export const GarageSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-11 w-full max-w-56" />
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-16 w-full" />
  </div>
);
