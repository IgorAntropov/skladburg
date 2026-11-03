import type { BlockerValue } from './blockers';
import type {
  BlockedHandlerValue,
  ILocationSource,
  LocationSnapshotValue,
  NavigateOptionsValue,
  ShouldBlockValue,
} from './locationTypes';

import {
  askLastTriggered,
  findTriggered,
} from './blockers';
import { createSnapshotReader } from './createSnapshotReader';
import { isSamePath } from './isSamePath';

const HASH_PREFIX = '#';

const toRawPath = (hash: string): string => (hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : hash);

const readEntryIndex = (state: unknown): number | undefined => {
  if (typeof state === 'object' && state !== null && 'entryIndex' in state && typeof state.entryIndex === 'number') {
    return state.entryIndex;
  }

  return undefined;
};

export const createHashLocation = (target: Window): ILocationSource => {
  const subscriptions = new Set<() => void>();
  const blockers: BlockerValue[] = [];
  const readSnapshot = createSnapshotReader();
  let lastHash = target.location.hash;
  let currentIndex: number | undefined;
  let focusRequest = 0;
  let isListening = false;
  let isProceeding = false;
  let revertedHash: string | undefined;

  const notifySubscriptions = (): void => {
    for (const subscription of [...subscriptions]) {
      subscription();
    }
  };

  const createHref = (path: string): string => `${HASH_PREFIX}${path}`;

  const createUrl = (hash: string): string => `${target.location.pathname}${target.location.search}${hash}`;

  const readHash = (): string => (revertedHash === undefined ? target.location.hash : lastHash);

  const getCurrentIndex = (): number => {
    if (currentIndex !== undefined) {
      return currentIndex;
    }

    const storedIndex = readEntryIndex(target.history.state);

    if (storedIndex === undefined) {
      target.history.replaceState({ entryIndex: 0 }, '');
    }

    currentIndex = storedIndex ?? 0;

    return currentIndex;
  };

  const performNavigation = (path: string, options?: NavigateOptionsValue): void => {
    const index = getCurrentIndex();
    const nextHash = createHref(path);
    const nextUrl = createUrl(nextHash);

    if (options?.isReplace === true || target.location.hash === nextHash) {
      target.history.replaceState({ entryIndex: index }, '', nextUrl);
    }
    else {
      currentIndex = index + 1;
      target.history.pushState({ entryIndex: currentIndex }, '', nextUrl);
    }

    if (options?.isFocusRequested === true) {
      focusRequest += 1;
    }

    revertedHash = undefined;
    lastHash = target.location.hash;
    notifySubscriptions();
  };

  const acceptExternalChange = (entryIndex: number | undefined): void => {
    currentIndex = entryIndex ?? getCurrentIndex() + 1;

    if (entryIndex === undefined) {
      target.history.replaceState({ entryIndex: currentIndex }, '');
    }

    isProceeding = false;
    revertedHash = undefined;
    lastHash = target.location.hash;
    notifySubscriptions();
  };

  const handleExternalChange = (): void => {
    const { hash } = target.location;
    const entryIndex = readEntryIndex(target.history.state);

    if (hash === lastHash) {
      revertedHash = undefined;
      currentIndex = entryIndex ?? currentIndex;

      return;
    }

    if (hash === revertedHash) {
      return;
    }

    const index = getCurrentIndex();
    const stepIndex = entryIndex ?? index + 1;
    const nextPath = toRawPath(hash);
    const isFree = isProceeding || stepIndex === index || isSamePath(nextPath, toRawPath(lastHash));
    const triggered = isFree ? [] : findTriggered(blockers, nextPath);

    if (triggered.length === 0) {
      acceptExternalChange(entryIndex);

      return;
    }

    revertedHash = hash;
    target.history.go(index - stepIndex);
    askLastTriggered(triggered, (): void => {
      isProceeding = true;
      target.history.go(stepIndex - getCurrentIndex());
    });
  };

  const syncListening = (): void => {
    const isNeeded = subscriptions.size > 0 || blockers.length > 0;

    if (isNeeded === isListening) {
      return;
    }

    isListening = isNeeded;

    if (isNeeded) {
      lastHash = target.location.hash;
      currentIndex = undefined;
      isProceeding = false;
      revertedHash = undefined;
      getCurrentIndex();
      target.addEventListener('hashchange', handleExternalChange);
      target.addEventListener('popstate', handleExternalChange);

      return;
    }

    target.removeEventListener('hashchange', handleExternalChange);
    target.removeEventListener('popstate', handleExternalChange);
  };

  const navigate = (path: string, options?: NavigateOptionsValue): void => {
    const triggered = isSamePath(path, toRawPath(readHash())) ? [] : findTriggered(blockers, path);

    if (triggered.length === 0) {
      performNavigation(path, options);

      return;
    }

    askLastTriggered(triggered, (): void => {
      performNavigation(path, options);
    });
  };

  const read = (): LocationSnapshotValue => {
    return readSnapshot(toRawPath(readHash()), focusRequest);
  };

  const reload = (): void => {
    target.location.reload();
  };

  const subscribe = (listener: () => void): (() => void) => {
    const subscription = (): void => {
      listener();
    };

    subscriptions.add(subscription);
    syncListening();

    return (): void => {
      if (subscriptions.delete(subscription)) {
        syncListening();
      }
    };
  };

  const block = (onBlocked: BlockedHandlerValue, shouldBlock?: ShouldBlockValue): (() => void) => {
    const blocker: BlockerValue = { onBlocked, shouldBlock };

    blockers.push(blocker);
    syncListening();

    return (): void => {
      const position = blockers.indexOf(blocker);

      if (position !== -1) {
        blockers.splice(position, 1);
        syncListening();
      }
    };
  };

  return {
    block,
    createHref,
    navigate,
    read,
    reload,
    subscribe,
  };
};
