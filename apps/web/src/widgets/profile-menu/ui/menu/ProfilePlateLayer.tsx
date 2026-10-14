import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  AnimatePresence,
  m,
  MotionScope,
  useAreMotionFeaturesLoaded,
  useIsPresent,
  useReducedMotion,
} from '@/shared/lib/motion';

import {
  PLATE_HIDDEN_STATE,
  PLATE_INSTANT_TRANSITION,
  PLATE_SHOWN_STATE,
  PLATE_TRANSITION,
} from './plateMotion';

const LAYER_CLASS_NAME = 'absolute top-full right-0 z-20 mt-2 w-max max-w-[calc(100vw-2rem)]';

const PLATE_CLASS_NAME = 'rounded-panel border border-line bg-panel-solid p-4 text-on-panel shadow-raised';

export interface ProfilePlateLayerProps {
  children: ReactNode;
  isShown: boolean;
  plateKey: string;
}

type PlatePresenceProps = Pick<ProfilePlateLayerProps, 'children'>;

const PlatePresence = ({ children }: PlatePresenceProps): ReactElement => {
  const isPresent = useIsPresent();
  const isReducedMotion = useReducedMotion() === true;
  const areFeaturesLoaded = useAreMotionFeaturesLoaded();

  const isEntranceSkipped = isReducedMotion || !areFeaturesLoaded;

  return (
    <m.div
      animate={PLATE_SHOWN_STATE}
      aria-hidden={isPresent ? undefined : true}
      className={LAYER_CLASS_NAME}
      exit={PLATE_HIDDEN_STATE}
      inert={!isPresent}
      initial={isEntranceSkipped ? false : PLATE_HIDDEN_STATE}
      transition={isReducedMotion ? PLATE_INSTANT_TRANSITION : PLATE_TRANSITION}
    >
      <div className={PLATE_CLASS_NAME}>{children}</div>
    </m.div>
  );
};

export const ProfilePlateLayer = ({ children, isShown, plateKey }: ProfilePlateLayerProps): ReactElement => {
  return (
    <MotionScope>
      <AnimatePresence>
        {isShown && <PlatePresence key={plateKey}>{children}</PlatePresence>}
      </AnimatePresence>
    </MotionScope>
  );
};
