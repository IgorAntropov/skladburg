import type {
  ILocationSource,
  LocationSnapshotValue,
  NavigateOptionsValue,
} from '../locationTypes';

import { createSnapshotReader } from '../createSnapshotReader';

export interface IMemoryLocation extends ILocationSource {
  back: () => void;
  readonly currentIndex: number;
  forward: () => void;
  readonly history: readonly string[];
  readonly reloadCount: number;
}

export const createMemoryLocation = (initialPath: string): IMemoryLocation => {
  const subscriptions = new Set<() => void>();
  const readSnapshot = createSnapshotReader();
  let entries: readonly string[] = [initialPath];
  let currentIndex = 0;
  let reloadCount = 0;

  const notifySubscriptions = (): void => {
    for (const subscription of [...subscriptions]) {
      subscription();
    }
  };

  const moveTo = (nextIndex: number): void => {
    if (nextIndex < 0 || nextIndex >= entries.length) {
      return;
    }

    currentIndex = nextIndex;
    notifySubscriptions();
  };

  const navigate = (path: string, options?: NavigateOptionsValue): void => {
    if (options?.isReplace === true) {
      entries = entries.map((entry, index) => (index === currentIndex ? path : entry));
    }
    else {
      entries = [...entries.slice(0, currentIndex + 1), path];
      currentIndex += 1;
    }

    notifySubscriptions();
  };

  const read = (): LocationSnapshotValue => readSnapshot(entries[currentIndex] ?? '/');

  const subscribe = (listener: () => void): (() => void) => {
    const subscription = (): void => {
      listener();
    };

    subscriptions.add(subscription);

    return (): void => {
      subscriptions.delete(subscription);
    };
  };

  return {
    back: (): void => {
      moveTo(currentIndex - 1);
    },
    createHref: (path: string): string => `#${path}`,
    get currentIndex(): number {
      return currentIndex;
    },
    forward: (): void => {
      moveTo(currentIndex + 1);
    },
    get history(): readonly string[] {
      return entries;
    },
    navigate,
    read,
    reload: (): void => {
      reloadCount += 1;
    },
    get reloadCount(): number {
      return reloadCount;
    },
    subscribe,
  };
};
