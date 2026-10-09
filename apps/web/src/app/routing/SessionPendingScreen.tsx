import type { ReactElement } from 'react';

import type { HudSkeletonZonesValue } from '@/widgets/hud-layout';

import { useI18n } from '@/shared/i18n';
import { HudLayoutSkeleton } from '@/widgets/hud-layout';

interface SessionPendingScreenProps {
  zones: HudSkeletonZonesValue;
}

export const SessionPendingScreen = ({ zones }: SessionPendingScreenProps): ReactElement => {
  const { t } = useI18n();

  const label = t('session.loading');

  return (
    <main aria-busy="true" className="flex flex-1 flex-col">
      <p className="sr-only">{label}</p>
      <HudLayoutSkeleton label={label} zones={zones} />
    </main>
  );
};
