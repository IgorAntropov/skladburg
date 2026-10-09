import type { ReactElement } from 'react';

import { ResetDemoConfirm } from '@/features/reset-demo';
import { useViewportClass } from '@/shared/lib/viewport';

const PLATE_CLASS_NAME = 'rounded-panel border border-line bg-panel-solid p-4 text-on-panel shadow-panel';

export interface ProfileResetConfirmProps {
  onClose: () => void;
}

export const ProfileResetConfirm = ({ onClose }: ProfileResetConfirmProps): ReactElement => {
  const viewportClass = useViewportClass();

  const isStacked = viewportClass === 'phone';

  return (
    <div className={PLATE_CLASS_NAME}>
      <ResetDemoConfirm isStacked={isStacked} onClose={onClose} />
    </div>
  );
};
