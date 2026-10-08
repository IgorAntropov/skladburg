import type {
  ILocationSource,
  LocationSnapshotValue,
  NavigateOptionsValue,
} from './locationTypes';

import { createSnapshotReader } from './createSnapshotReader';

const HASH_PREFIX = '#';

export const createHashLocation = (target: Window): ILocationSource => {
  const subscriptions = new Set<() => void>();
  const readSnapshot = createSnapshotReader();
  let lastHash = target.location.hash;

  const notifySubscriptions = (): void => {
    for (const subscription of [...subscriptions]) {
      subscription();
    }
  };

  const handleExternalChange = (): void => {
    if (target.location.hash === lastHash) {
      return;
    }

    lastHash = target.location.hash;
    notifySubscriptions();
  };

  const createHref = (path: string): string => `${HASH_PREFIX}${path}`;

  const navigate = (path: string, options?: NavigateOptionsValue): void => {
    const nextHash = createHref(path);
    const isReplace = options?.isReplace === true || target.location.hash === nextHash;
    const nextUrl = `${target.location.pathname}${target.location.search}${nextHash}`;

    if (isReplace) {
      target.history.replaceState(null, '', nextUrl);
    }
    else {
      target.history.pushState(null, '', nextUrl);
    }

    lastHash = target.location.hash;
    notifySubscriptions();
  };

  const read = (): LocationSnapshotValue => {
    const { hash } = target.location;

    return readSnapshot(hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : hash);
  };

  const reload = (): void => {
    target.location.reload();
  };

  const subscribe = (listener: () => void): (() => void) => {
    const subscription = (): void => {
      listener();
    };

    if (subscriptions.size === 0) {
      lastHash = target.location.hash;
      target.addEventListener('hashchange', handleExternalChange);
      target.addEventListener('popstate', handleExternalChange);
    }

    subscriptions.add(subscription);

    return (): void => {
      if (!subscriptions.delete(subscription)) {
        return;
      }

      if (subscriptions.size === 0) {
        target.removeEventListener('hashchange', handleExternalChange);
        target.removeEventListener('popstate', handleExternalChange);
      }
    };
  };

  return {
    createHref,
    navigate,
    read,
    reload,
    subscribe,
  };
};
