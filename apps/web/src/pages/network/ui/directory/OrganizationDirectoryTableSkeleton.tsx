import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui';

import { OrganizationDirectoryListSkeleton } from '../OrganizationDirectoryListSkeleton';

const SKELETON_ROW_IDS = ['first', 'second', 'third', 'fourth'] as const;

const GRID_CLASS_NAME = 'grid grid-cols-[25%_32%_23%_20%] items-center';

const COLUMN_LABEL_KEYS = [
  'organization.directory.column.name',
  'organization.directory.column.profiles',
  'organization.directory.column.spheres',
  'organization.directory.column.cities',
] as const;

export const OrganizationDirectoryTableSkeleton = (): ReactElement => {
  const { t } = useI18n();

  return (
    <>
      <div className="isolate overflow-hidden rounded-control border border-line bg-panel-solid @max-lg:hidden">
        <div className={cn(GRID_CLASS_NAME, 'border-b border-line')}>
          {COLUMN_LABEL_KEYS.map(labelKey => (
            <span className="px-3 py-2 text-sm leading-5 font-medium text-on-panel-muted" key={labelKey}>{t(labelKey)}</span>
          ))}
        </div>
        {SKELETON_ROW_IDS.map(rowId => (
          <div className={cn(GRID_CLASS_NAME, 'h-14 border-b border-line last:border-b-0')} key={rowId}>
            <div className="px-3">
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="flex items-center gap-1 px-3">
              <Skeleton className="h-6.5 w-24" shape="circle" />
              <Skeleton className="size-6.5" shape="circle" />
            </div>
            <div className="px-3">
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="px-3">
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        ))}
      </div>
      <div className="@lg:hidden">
        <OrganizationDirectoryListSkeleton />
      </div>
    </>
  );
};
