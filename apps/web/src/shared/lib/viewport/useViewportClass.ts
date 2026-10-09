import { useSyncExternalStore } from 'react';

import type { ViewportClassValue } from './viewportTypes';

import { readViewportClass } from './readViewportClass';
import { getViewportQueryLists } from './viewportQueryLists';

const CHANGE_EVENT = 'change';

const subscribeToViewport = (notify: () => void): (() => void) => {
  const queryLists = getViewportQueryLists();

  if (queryLists === undefined) {
    return () => undefined;
  }

  const watchedLists = [queryLists.desktop, queryLists.tablet];

  watchedLists.forEach((queryList) => {
    queryList.addEventListener(CHANGE_EVENT, notify);
  });

  return () => {
    watchedLists.forEach((queryList) => {
      queryList.removeEventListener(CHANGE_EVENT, notify);
    });
  };
};

const getViewportSnapshot = (): ViewportClassValue => readViewportClass(getViewportQueryLists());

const getServerViewportSnapshot = (): ViewportClassValue => 'desktop';

export const useViewportClass = (): ViewportClassValue => {
  return useSyncExternalStore(subscribeToViewport, getViewportSnapshot, getServerViewportSnapshot);
};
