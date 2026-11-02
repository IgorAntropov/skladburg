import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

import { ShowcaseListSkeleton } from './ShowcaseListSkeleton';

export const ShowcasePanelSkeleton = (): ReactElement => (
  <div className="@container flex flex-col gap-3">
    <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-[1.4fr_1fr_1fr]">
      <Skeleton className="h-14 w-full @lg:col-span-2 @3xl:col-span-1" />
      <Skeleton className="hidden h-14 w-full @lg:block" />
      <Skeleton className="hidden h-14 w-full @lg:block" />
      <Skeleton className="h-11 w-32 @lg:hidden" />
      <Skeleton className="-mt-1 h-5 w-48 @lg:hidden" />
    </div>
    <ShowcaseListSkeleton />
  </div>
);
