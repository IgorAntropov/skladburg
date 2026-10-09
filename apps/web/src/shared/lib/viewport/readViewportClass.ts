import type { ViewportQueryListsValue } from './viewportQueryLists';
import type { ViewportClassValue } from './viewportTypes';

export const readViewportClass = (queryLists: undefined | ViewportQueryListsValue): ViewportClassValue => {
  if (queryLists === undefined || queryLists.desktop.matches) {
    return 'desktop';
  }

  return queryLists.tablet.matches ? 'tablet' : 'phone';
};
