import type { ReactElement } from 'react';

import { InstallInstructions } from '@/features/install-app';

import { ProfilePlateLayer } from './ProfilePlateLayer';

export interface ProfileInstallInstructionsLayerProps {
  isShown: boolean;
  onClose: () => void;
}

export const ProfileInstallInstructionsLayer = ({
  isShown,
  onClose,
}: ProfileInstallInstructionsLayerProps): ReactElement => {
  return (
    <ProfilePlateLayer isShown={isShown} plateKey="install-instructions">
      <InstallInstructions onClose={onClose} />
    </ProfilePlateLayer>
  );
};
