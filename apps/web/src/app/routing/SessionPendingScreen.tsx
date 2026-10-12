import type { ReactElement } from 'react';

import type { SkeletonTimingValue } from '@/shared/ui';
import type { HudSkeletonZonesValue } from '@/widgets/hud-layout';

import { useI18n } from '@/shared/i18n';
import { HudLayoutSkeleton } from '@/widgets/hud-layout';

interface SessionPendingScreenProps {
  timing?: SkeletonTimingValue | undefined;
  zones: HudSkeletonZonesValue;
}

export const SessionPendingScreen = ({ timing, zones }: SessionPendingScreenProps): ReactElement => {
  const { t } = useI18n();

  const label = t('session.loading');

  return (
    <main aria-busy="true" className="flex flex-1 flex-col">
      <p className="sr-only">{label}</p>
      <HudLayoutSkeleton label={label} timing={timing} zones={zones} />
    </main>
  );
};
