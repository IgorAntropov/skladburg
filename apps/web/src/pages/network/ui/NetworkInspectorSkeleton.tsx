import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

import type { InspectorSkeletonKindValue } from '../lib/getInspectorSkeletonKind';

interface NetworkInspectorSkeletonProps {
  isOwn?: boolean | undefined;
  kind: InspectorSkeletonKindValue;
}

interface SkeletonLineProps {
  className: string;
}

const SITE_PROPERTY_IDS = ['first', 'second', 'third', 'fourth'] as const;

const ORGANIZATION_PROPERTY_IDS = ['first', 'second'] as const;

const CITY_ROW_IDS = ['first', 'second'] as const;

const CHECKED_LINE_IDS = ['first', 'second'] as const;

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

const SkeletonLine = ({ className }: SkeletonLineProps): ReactElement => (
  <div className="flex h-5 items-center">
    <Skeleton className={className} />
  </div>
);

const SiteSkeleton = (): ReactElement => (
  <>
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-6.5 w-28" shape="circle" />
    </div>
    <div className="flex flex-col gap-3">
      {SITE_PROPERTY_IDS.map(propertyId => <SkeletonProperty key={propertyId} />)}
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
      <SkeletonLine className="h-3.5 w-32" />
      {CITY_ROW_IDS.map(rowId => <SkeletonCityRow key={rowId} />)}
    </div>
  </>
);

const OrganizationSkeleton = ({ isOwn }: { isOwn: boolean }): ReactElement => (
  <>
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-14" />
      {isOwn && <Skeleton className="h-6.5 w-28" shape="circle" />}
    </div>
    <div className="flex flex-col gap-2">
      <SkeletonLine className="h-3.5 w-32" />
      <div className="flex flex-col gap-2 rounded-control border border-line p-3">
        <Skeleton className="h-6.5 w-48" shape="circle" />
        <SkeletonLine className="h-3.5 w-24" />
        <div className="flex flex-col gap-1.5">
          {CHECKED_LINE_IDS.map(lineId => <SkeletonLine className="h-3.5 w-3/4" key={lineId} />)}
        </div>
      </div>
    </div>
    <div className="flex flex-col gap-3">
      {ORGANIZATION_PROPERTY_IDS.map(propertyId => <SkeletonProperty key={propertyId} />)}
    </div>
    <div className="flex flex-col gap-2">
      <SkeletonLine className="h-3.5 w-24" />
      <div className="flex h-16 flex-col justify-center gap-1 rounded-control border border-line px-3">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3.5 w-1/4" />
      </div>
    </div>
  </>
);

export const NetworkInspectorSkeleton = ({ isOwn = false, kind }: NetworkInspectorSkeletonProps): ReactElement => (
  <div className="flex flex-col gap-4">
    {kind === 'site' && <SiteSkeleton />}
    {kind === 'city' && <CitySkeleton />}
    {kind === 'organization' && <OrganizationSkeleton isOwn={isOwn} />}
  </div>
);
