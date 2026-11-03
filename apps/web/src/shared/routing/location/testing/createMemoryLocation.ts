import type { BlockerValue } from '../blockers';
import type {
  BlockedHandlerValue,
  ILocationSource,
  LocationSnapshotValue,
  NavigateOptionsValue,
  ShouldBlockValue,
} from '../locationTypes';

import {
  askLastTriggered,
  findTriggered,
} from '../blockers';
import { createSnapshotReader } from '../createSnapshotReader';
import { isSamePath } from '../isSamePath';

export interface IMemoryLocation extends ILocationSource {
  back: () => void;
  readonly currentIndex: number;
  forward: () => void;
  readonly history: readonly string[];
  readonly reloadCount: number;
}

export const createMemoryLocation = (initialPath: string): IMemoryLocation => {
  const subscriptions = new Set<() => void>();
  const blockers: BlockerValue[] = [];
  const readSnapshot = createSnapshotReader();
  let entries: readonly string[] = [initialPath];
  let currentIndex = 0;
  let focusRequest = 0;
  let reloadCount = 0;

  const notifySubscriptions = (): void => {
    for (const subscription of [...subscriptions]) {
      subscription();
    }
  };

  const guard = (path: string, commit: () => void): void => {
    const triggered = isSamePath(path, entries[currentIndex] ?? '/') ? [] : findTriggered(blockers, path);

    if (triggered.length === 0) {
      commit();

      return;
    }

    askLastTriggered(triggered, commit);
  };

  const moveTo = (nextIndex: number): void => {
    if (nextIndex < 0 || nextIndex >= entries.length) {
      return;
    }

    guard(entries[nextIndex] ?? '/', () => {
      currentIndex = nextIndex;
      notifySubscriptions();
    });
  };

  const navigate = (path: string, options?: NavigateOptionsValue): void => {
    guard(path, () => {
      if (options?.isReplace === true) {
        entries = entries.map((entry, index) => (index === currentIndex ? path : entry));
      }
      else {
        entries = [...entries.slice(0, currentIndex + 1), path];
        currentIndex += 1;
      }

      if (options?.isFocusRequested === true) {
        focusRequest += 1;
      }

      notifySubscriptions();
    });
  };

  const read = (): LocationSnapshotValue => readSnapshot(entries[currentIndex] ?? '/', focusRequest);

  const subscribe = (listener: () => void): (() => void) => {
    const subscription = (): void => {
      listener();
    };

    subscriptions.add(subscription);

    return (): void => {
      subscriptions.delete(subscription);
    };
  };

  const block = (onBlocked: BlockedHandlerValue, shouldBlock?: ShouldBlockValue): (() => void) => {
    const blocker: BlockerValue = { onBlocked, shouldBlock };

    blockers.push(blocker);

    return (): void => {
      const position = blockers.indexOf(blocker);

      if (position !== -1) {
        blockers.splice(position, 1);
      }
    };
  };

  return {
    back: (): void => {
      moveTo(currentIndex - 1);
    },
    block,
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
