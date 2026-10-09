import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

const SKELETON_GROUP_IDS = ['first', 'second'] as const;

const SKELETON_ROW_IDS = ['first', 'second', 'third', 'fourth'] as const;

export const PersonaMenuSkeleton = (): ReactElement => {
  const { t } = useI18n();
  const isFilled = useDelayedVisibility(true);

  return (
    <SkeletonGroup isFilled={isFilled} label={t('persona.loading')}>
      {SKELETON_GROUP_IDS.map(groupId => (
        <div key={groupId}>
          <div className="flex min-h-9 items-center px-3 py-2">
            <Skeleton className="h-3.5 w-28" />
          </div>
          {SKELETON_ROW_IDS.map(rowId => (
            <div className="flex min-h-11 items-center gap-2 px-3 py-1" key={rowId}>
              <Skeleton className="size-8" shape="circle" />
              <div className="flex flex-col">
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </SkeletonGroup>
  );
};
