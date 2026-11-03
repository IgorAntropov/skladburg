import type { ReactElement } from 'react';

import {
  Skeleton,
  SkeletonGroup,
} from '@/shared/ui';

const SKELETON_ROWS = ['first', 'second', 'third'] as const;

interface SearchGroupSkeletonProps {
  isFilled: boolean;
  label: string;
}

export const SearchGroupSkeleton = ({ isFilled, label }: SearchGroupSkeletonProps): ReactElement => (
  <SkeletonGroup isFilled={isFilled} label={label}>
    {SKELETON_ROWS.map(rowId => (
      <div className="flex h-15 items-center gap-3 px-3" key={rowId}>
        <Skeleton className="size-5" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-[55%]" />
          <Skeleton className="h-3.5 w-[40%]" />
        </div>
      </div>
    ))}
  </SkeletonGroup>
);
