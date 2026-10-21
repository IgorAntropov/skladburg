import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

interface NetworkInspectorSkeletonProps {
  kind: 'city' | 'site';
}

const PROPERTY_IDS = ['first', 'second', 'third'] as const;

const CITY_ROW_IDS = ['first', 'second'] as const;

const SkeletonProperty = (): ReactElement => (
  <div className="flex flex-col">
    <div className="flex h-5 items-center">
      <Skeleton className="h-3.5 w-20" />
    </div>
    <div className="flex h-6 items-center">
      <Skeleton className="h-5 w-40" />
    </div>
  </div>
);

const SkeletonCityRow = (): ReactElement => (
  <div className="flex h-18 flex-col gap-1 rounded-control border border-line px-3 py-2">
    <div className="flex h-6 items-center">
      <Skeleton className="h-4 w-2/5" />
    </div>
    <Skeleton className="h-6.5 w-28" shape="circle" />
  </div>
);

const SiteSkeleton = (): ReactElement => (
  <>
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-6.5 w-28" shape="circle" />
    </div>
    <div className="flex flex-col gap-3">
      {PROPERTY_IDS.map(propertyId => <SkeletonProperty key={propertyId} />)}
    </div>
    <Skeleton className="h-11 w-36" />
  </>
);

const CitySkeleton = (): ReactElement => (
  <>
    <div className="flex h-5 items-center">
      <Skeleton className="h-4 w-14" />
    </div>
    <div className="flex flex-col gap-3">
      <SkeletonProperty />
    </div>
    <div className="flex flex-col gap-2">
      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-32" />
      </div>
      {CITY_ROW_IDS.map(rowId => <SkeletonCityRow key={rowId} />)}
    </div>
  </>
);

export const NetworkInspectorSkeleton = ({ kind }: NetworkInspectorSkeletonProps): ReactElement => (
  <div className="flex flex-col gap-4">
    {kind === 'site' ? <SiteSkeleton /> : <CitySkeleton />}
  </div>
);
