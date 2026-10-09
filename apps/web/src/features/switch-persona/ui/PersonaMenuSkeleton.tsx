import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

const SKELETON_ROW_IDS = ['first', 'second', 'third', 'fourth'] as const;

export const PersonaMenuSkeleton = (): ReactElement => {
  const { t } = useI18n();
  const isFilled = useDelayedVisibility(true);

  return (
    <SkeletonGroup isFilled={isFilled} label={t('persona.loading')}>
      <div className="flex min-h-9 items-center px-3 py-2">
        <Skeleton className="h-3.5 w-28" />
      </div>
      {SKELETON_ROW_IDS.map(rowId => (
        <div className="flex min-h-11 items-center gap-2.5 px-3 py-2" key={rowId}>
          <Skeleton className="size-8" shape="circle" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
};
