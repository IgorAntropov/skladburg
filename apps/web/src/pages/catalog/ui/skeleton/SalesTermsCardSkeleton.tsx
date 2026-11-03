import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const TERM_IDS = ['delivery', 'preparation', 'autoConfirm'] as const;

export const SalesTermsCardSkeleton = (): ReactElement => (
  <div className="@container flex flex-col gap-3 rounded-control border border-line p-3">
    <div className="flex items-center justify-between gap-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-11 w-28" />
    </div>
    <div className="grid grid-cols-1 gap-2 @lg:grid-cols-3 @lg:gap-3">
      {TERM_IDS.map(termId => (
        <div className="flex flex-col gap-1" key={termId}>
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-5 w-30" />
        </div>
      ))}
    </div>
  </div>
);
