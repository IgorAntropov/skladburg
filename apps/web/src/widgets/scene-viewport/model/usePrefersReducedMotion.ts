import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CHANGE_EVENT = 'change';

const readQueryList = (): MediaQueryList | undefined => {
  const source: unknown = Reflect.get(window, 'matchMedia');

  return typeof source === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : undefined;
};

const subscribeToReducedMotion = (notify: () => void): (() => void) => {
  const queryList = readQueryList();

  if (queryList === undefined) {
    return () => undefined;
  }

  queryList.addEventListener(CHANGE_EVENT, notify);

  return () => {
    queryList.removeEventListener(CHANGE_EVENT, notify);
  };
};

const getReducedMotionSnapshot = (): boolean => readQueryList()?.matches ?? false;

const getServerReducedMotionSnapshot = (): boolean => false;

export const usePrefersReducedMotion = (): boolean => {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, getServerReducedMotionSnapshot);
};
