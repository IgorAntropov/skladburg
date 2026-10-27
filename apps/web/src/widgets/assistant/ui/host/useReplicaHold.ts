import type { FocusEvent } from 'react';

import { useRef } from 'react';

export interface ReplicaHoldHandlersValue {
  onBlur: (event: FocusEvent<HTMLElement>) => void;
  onFocus: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export interface UseReplicaHoldOptionsValue {
  onHold: () => void;
  onRelease: () => void;
}

export const useReplicaHold = ({ onHold, onRelease }: UseReplicaHoldOptionsValue): ReplicaHoldHandlersValue => {
  const isPointerInsideRef = useRef(false);
  const isFocusInsideRef = useRef(false);
  const isHeldRef = useRef(false);

  const sync = (): void => {
    const isHeld = isPointerInsideRef.current || isFocusInsideRef.current;

    if (isHeld === isHeldRef.current) {
      return;
    }

    isHeldRef.current = isHeld;

    if (isHeld) {
      onHold();
    }
    else {
      onRelease();
    }
  };

  return {
    onBlur: (event: FocusEvent<HTMLElement>): void => {
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
        return;
      }

      isFocusInsideRef.current = false;
      sync();
    },
    onFocus: (): void => {
      isFocusInsideRef.current = true;
      sync();
    },
    onPointerEnter: (): void => {
      isPointerInsideRef.current = true;
      sync();
    },
    onPointerLeave: (): void => {
      isPointerInsideRef.current = false;
      sync();
    },
  };
};
