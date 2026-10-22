import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useEffect,
  useRef,
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
  onDismiss?: (() => void) | undefined;
  plateKey: string;
}

type PlatePresenceProps = Pick<ProfilePlateLayerProps, 'children' | 'onDismiss'>;

const PlatePresence = ({ children, onDismiss }: PlatePresenceProps): ReactElement => {
  const isPresent = useIsPresent();
  const isReducedMotion = useReducedMotion() === true;
  const areFeaturesLoaded = useAreMotionFeaturesLoaded();
  const plateRef = useRef<HTMLDivElement>(null);

  const isEntranceSkipped = isReducedMotion || !areFeaturesLoaded;

  useEffect(() => {
    if (!isPresent || onDismiss === undefined) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const plate = plateRef.current;

      if (plate === null || !(event.target instanceof Node) || plate.contains(event.target)) {
        return;
      }
      console.log('> PlatePresence -> handlePointerDown:', {});
      onDismiss();
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isPresent, onDismiss]);

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
      <div className={PLATE_CLASS_NAME} ref={plateRef}>{children}</div>
    </m.div>
  );
};

export const ProfilePlateLayer = ({ children, isShown, onDismiss, plateKey }: ProfilePlateLayerProps): ReactElement => {
  return (
    <MotionScope>
      <AnimatePresence>
        {isShown && <PlatePresence key={plateKey} onDismiss={onDismiss}>{children}</PlatePresence>}
      </AnimatePresence>
    </MotionScope>
  );
};
