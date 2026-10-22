import type { ReactElement } from 'react';

import { ProfileMyProfileSlot } from './ProfileMyProfileSlot';
import { ProfilePlateLayer } from './ProfilePlateLayer';

export interface ProfileMyProfileLayerProps {
  isShown: boolean;
  onClose: () => void;
  onDismiss: () => void;
}

export const ProfileMyProfileLayer = ({ isShown, onClose, onDismiss }: ProfileMyProfileLayerProps): ReactElement => {
  return (
    <ProfilePlateLayer isShown={isShown} onDismiss={onDismiss} plateKey="my-profile">
      <ProfileMyProfileSlot onClose={onClose} onDismiss={onDismiss} />
    </ProfilePlateLayer>
  );
};
