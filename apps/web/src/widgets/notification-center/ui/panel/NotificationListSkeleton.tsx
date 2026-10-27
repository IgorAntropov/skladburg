import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const ROW_CLASS_NAME = 'flex gap-3 border-b border-line pt-3 pr-4 pl-3';

const LINE_CELL_CLASS_NAME = 'flex h-6 items-center';

const SKELETON_ROWS = ['first', 'second', 'third'] as const;

export const NotificationListSkeleton = (): ReactElement => {
  return (
    <div>
      {SKELETON_ROWS.map(id => (
        <div className={ROW_CLASS_NAME} key={id}>
          <Skeleton className="size-8" shape="circle" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className={LINE_CELL_CLASS_NAME}>
              <Skeleton className="h-4 w-[92%]" />
            </div>
            <div className={LINE_CELL_CLASS_NAME}>
              <Skeleton className="h-4 w-[64%]" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-20" />
            </div>
            <div className="flex h-11 items-center">
              <Skeleton className="h-3.5 w-[120px]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
