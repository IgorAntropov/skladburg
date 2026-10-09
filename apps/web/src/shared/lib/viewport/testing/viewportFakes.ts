import type { ViewportClassValue } from '../viewportTypes';

import { VIEWPORT_MEDIA_QUERIES } from '../viewportTypes';

export interface IFakeViewport {
  readonly restore: () => void;
  readonly setViewportClass: (nextClass: ViewportClassValue) => void;
}

const isQueryMatching = (query: string, viewportClass: ViewportClassValue): boolean => {
  if (query === VIEWPORT_MEDIA_QUERIES.desktop) {
    return viewportClass === 'desktop';
  }

  return query === VIEWPORT_MEDIA_QUERIES.tablet && viewportClass !== 'phone';
};

class FakeViewportQueryList extends EventTarget implements MediaQueryList {
  matches: boolean;
  readonly media: string;
  onchange = null;

  constructor(media: string, matches: boolean) {
    super();
    this.media = media;
    this.matches = matches;
  }

  addListener(): void {
    throw new Error('deprecated api is not used');
  }

  removeListener(): void {
    throw new Error('deprecated api is not used');
  }
}

export const installFakeViewport = (initialClass: ViewportClassValue): IFakeViewport => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const queryLists = new Map<string, FakeViewportQueryList>();
  let currentClass = initialClass;

  const matchMedia = (query: string): MediaQueryList => {
    const existing = queryLists.get(query);

    if (existing !== undefined) {
      return existing;
    }

    const created = new FakeViewportQueryList(query, isQueryMatching(query, currentClass));
    queryLists.set(query, created);

    return created;
  };

  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia, writable: true });

  return {
    restore: () => {
      if (previousDescriptor === undefined) {
        Reflect.deleteProperty(window, 'matchMedia');

        return;
      }

      Object.defineProperty(window, 'matchMedia', previousDescriptor);
    },
    setViewportClass: (nextClass) => {
      currentClass = nextClass;
      queryLists.forEach((queryList, query) => {
        const nextMatches = isQueryMatching(query, nextClass);

        if (queryList.matches !== nextMatches) {
          queryList.matches = nextMatches;
          queryList.dispatchEvent(new Event('change'));
        }
      });
    },
  };
};
