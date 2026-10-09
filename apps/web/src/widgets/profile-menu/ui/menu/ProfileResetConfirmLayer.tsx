import type { ReactElement } from 'react';

import {
  AnimatePresence,
  m,
  MotionScope,
  useAreMotionFeaturesLoaded,
  useIsPresent,
  useReducedMotion,
} from '@/shared/lib/motion';

import { ProfileResetConfirm } from './ProfileResetConfirm';
import {
  RESET_CONFIRM_HIDDEN_STATE,
  RESET_CONFIRM_INSTANT_TRANSITION,
  RESET_CONFIRM_SHOWN_STATE,
  RESET_CONFIRM_TRANSITION,
} from './resetConfirmMotion';

const LAYER_CLASS_NAME = 'absolute top-full right-0 z-20 mt-2 w-max max-w-[calc(100vw-2rem)]';

export interface ProfileResetConfirmLayerProps {
  isShown: boolean;
  onClose: () => void;
}

const ResetConfirmPresence = ({ onClose }: Pick<ProfileResetConfirmLayerProps, 'onClose'>): ReactElement => {
  const isPresent = useIsPresent();
  const isReducedMotion = useReducedMotion() === true;
  const areFeaturesLoaded = useAreMotionFeaturesLoaded();

  const isEntranceSkipped = isReducedMotion || !areFeaturesLoaded;

  return (
    <m.div
      animate={RESET_CONFIRM_SHOWN_STATE}
      aria-hidden={isPresent ? undefined : true}
      className={LAYER_CLASS_NAME}
      data-testid="profile-reset-confirm-layer"
      exit={RESET_CONFIRM_HIDDEN_STATE}
      inert={!isPresent}
      initial={isEntranceSkipped ? false : RESET_CONFIRM_HIDDEN_STATE}
      transition={isReducedMotion ? RESET_CONFIRM_INSTANT_TRANSITION : RESET_CONFIRM_TRANSITION}
    >
      <ProfileResetConfirm onClose={onClose} />
    </m.div>
  );
};

export const ProfileResetConfirmLayer = ({ isShown, onClose }: ProfileResetConfirmLayerProps): ReactElement => {
  return (
    <MotionScope>
      <AnimatePresence>
        {isShown && <ResetConfirmPresence key="reset-confirm" onClose={onClose} />}
      </AnimatePresence>
    </MotionScope>
  );
};
