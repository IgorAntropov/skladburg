import { VIEWPORT_MEDIA_QUERIES } from './viewportTypes';

export interface ViewportQueryListsValue {
  desktop: MediaQueryList;
  tablet: MediaQueryList;
}

interface CachedQueryListsValue {
  lists: ViewportQueryListsValue;
  source: unknown;
}

let cachedQueryLists: CachedQueryListsValue | undefined;

export const getViewportQueryLists = (): undefined | ViewportQueryListsValue => {
  const source: unknown = Reflect.get(window, 'matchMedia');

  if (typeof source !== 'function') {
    return undefined;
  }

  if (cachedQueryLists?.source === source) {
    return cachedQueryLists.lists;
  }

  const lists: ViewportQueryListsValue = {
    desktop: window.matchMedia(VIEWPORT_MEDIA_QUERIES.desktop),
    tablet: window.matchMedia(VIEWPORT_MEDIA_QUERIES.tablet),
  };
  cachedQueryLists = { lists, source };

  return lists;
};
