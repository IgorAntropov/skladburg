import type { ReactElement } from 'react';

import { LocateFixed } from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { useIsSceneCameraReady } from '@/widgets/scene-viewport';

import { useNetworkMapStore } from '../../model/useNetworkMapStore';

interface ShowOnMapButtonProps {
  objectId: string;
}

export const ShowOnMapButton = ({ objectId }: ShowOnMapButtonProps): null | ReactElement => {
  const { t } = useI18n();
  const isCameraReady = useIsSceneCameraReady();
  const requestFocus = useNetworkMapStore(state => state.requestFocus);

  const handleClick = (): void => {
    console.log('> ShowOnMapButton -> handleClick:', { objectId });
    requestFocus(objectId);
  };

  if (!isCameraReady) {
    return null;
  }

  return (
    <Button data-testid="network-inspector-show-on-map" onClick={handleClick} size="md" variant="secondary">
      <LocateFixed aria-hidden className="size-5 shrink-0" />
      {t('network.inspector.showOnMap')}
    </Button>
  );
};
