import type { ReactElement } from 'react';

import { ResetDemoConfirm } from '@/features/reset-demo';
import { useViewportClass } from '@/shared/lib/viewport';

export interface ProfileResetConfirmProps {
  onClose: () => void;
}

export const ProfileResetConfirm = ({ onClose }: ProfileResetConfirmProps): ReactElement => {
  const viewportClass = useViewportClass();

  const isStacked = viewportClass === 'phone';

  return <ResetDemoConfirm isStacked={isStacked} onClose={onClose} />;
};
