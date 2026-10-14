import type { ReactElement } from 'react';

import { ProfilePlateLayer } from './ProfilePlateLayer';
import { ProfileResetConfirm } from './ProfileResetConfirm';

export interface ProfileResetConfirmLayerProps {
  isShown: boolean;
  onClose: () => void;
}

export const ProfileResetConfirmLayer = ({ isShown, onClose }: ProfileResetConfirmLayerProps): ReactElement => {
  return (
    <ProfilePlateLayer isShown={isShown} plateKey="reset-confirm">
      <ProfileResetConfirm onClose={onClose} />
    </ProfilePlateLayer>
  );
};
