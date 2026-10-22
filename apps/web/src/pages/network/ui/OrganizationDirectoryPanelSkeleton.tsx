import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

export const OrganizationDirectoryPanelSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-6">
    <div className="flex h-11 items-center">
      <Skeleton className="h-8 w-64" />
    </div>
    <Skeleton className="h-72 w-full" />
  </div>
);
