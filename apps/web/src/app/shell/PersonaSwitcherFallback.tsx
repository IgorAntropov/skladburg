import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import { PERSONA_SWITCHER_WIDTH_CLASS_NAME } from './personaSwitcherWidth';

const PERSONA_SWITCHER_SKELETON_CLASS_NAME = cn('h-11', PERSONA_SWITCHER_WIDTH_CLASS_NAME);

export const PersonaSwitcherFallback = (): ReactElement => {
  const { t } = useI18n();
  const isFilled = useDelayedVisibility(true);

  return (
    <SkeletonGroup isFilled={isFilled} label={t('persona.loading')}>
      <Skeleton className={PERSONA_SWITCHER_SKELETON_CLASS_NAME} />
    </SkeletonGroup>
  );
};
