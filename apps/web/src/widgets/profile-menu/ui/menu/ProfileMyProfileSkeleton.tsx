import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

export const ProfileMyProfileSkeleton = (): ReactElement => {
  const { t } = useI18n();
  const isFilled = useDelayedVisibility(true);

  return (
    <SkeletonGroup isFilled={isFilled} label={t('profile.myProfile.loading')}>
      <div className="flex w-72 max-w-full flex-col gap-4">
        <div className="flex w-full items-start gap-3">
          <Skeleton className="size-16" shape="circle" />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <div className="flex h-6 items-center">
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-44" />
            </div>
            <Skeleton className="mt-1.5 h-6.5 w-28" shape="circle" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11 w-40" />
          <div className="flex items-start gap-2">
            <Skeleton className="mt-0.5 size-4" shape="circle" />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-full" />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-3/5" />
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-line pt-2">
          <div className="flex h-11 items-center">
            <Skeleton className="h-3.5 w-36" />
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
};
