export type FakeTraversalModeValue = 'drop' | 'sum';

export interface IFakeBrowserWindow {
  back: () => void;
  readonly entries: readonly string[];
  forward: () => void;
  readonly goCalls: readonly number[];
  readonly hash: string;
  readonly index: number;
  readonly isUnloaded: boolean;
  settle: () => void;
  step: () => boolean;
  typeHash: (hash: string) => void;
  readonly window: Window;
}

interface FakeEntryValue {
  hash: string;
  state: unknown;
}

const MAX_STEPS = 500;

const readHashFromUrl = (url: string): string => {
  const hashIndex = url.indexOf('#');

  return hashIndex === -1 ? '' : url.slice(hashIndex);
};

export const createFakeBrowserWindow = (mode: FakeTraversalModeValue, initialHash = ''): IFakeBrowserWindow => {
  const entries: FakeEntryValue[] = [{ hash: initialHash, state: null }];
  const listeners = new Map<string, Set<() => void>>();
  const mainTasks: (() => void)[] = [];
  const browserTasks: (() => void)[] = [];
  const goCalls: number[] = [];
  let index = 0;
  let pendingTarget: number | undefined;
  let isUnloaded = false;

  const dispatch = (type: string): void => {
    for (const listener of [...(listeners.get(type) ?? [])]) {
      listener();
    }
  };

  const commitTraversal = (): void => {
    const target = pendingTarget;

    pendingTarget = undefined;

    if (target === undefined || target === index || target >= entries.length) {
      return;
    }

    if (target < 0) {
      isUnloaded = true;

      return;
    }

    const previousHash = entries[index]?.hash;

    index = target;
    dispatch('popstate');

    if (entries[index]?.hash !== previousHash) {
      mainTasks.push(() => {
        dispatch('hashchange');
      });
    }
  };

  const requestTraversal = (delta: number): void => {
    if (pendingTarget === undefined) {
      browserTasks.push(commitTraversal);
    }

    pendingTarget = (pendingTarget ?? index) + delta;
  };

  const readEntry = (): FakeEntryValue => entries[index] ?? { hash: '', state: null };

  const writeEntry = (state: unknown, url: string | undefined): void => {
    const entry = readEntry();

    entry.state = state;

    if (url !== undefined) {
      entry.hash = readHashFromUrl(url);
    }
  };

  const fakeWindow = {
    addEventListener: (type: string, listener: () => void): void => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    },
    history: {
      go: (delta: number): void => {
        goCalls.push(delta);

        if (mode === 'drop' && pendingTarget !== undefined) {
          return;
        }

        requestTraversal(delta);
      },
      get length(): number {
        return entries.length;
      },
      pushState: (state: unknown, _unused: string, url: string): void => {
        entries.splice(index + 1);
        entries.push({ hash: readHashFromUrl(url), state });
        index += 1;
      },
      replaceState: (state: unknown, _unused: string, url?: string): void => {
        writeEntry(state, url);
      },
      get state(): unknown {
        return readEntry().state;
      },
    },
    location: {
      get hash(): string {
        return readEntry().hash;
      },
      pathname: '/',
      reload: (): void => undefined,
      search: '',
    },
    removeEventListener: (type: string, listener: () => void): void => {
      listeners.get(type)?.delete(listener);
    },
  };

  const step = (): boolean => {
    const task = mainTasks.shift() ?? browserTasks.shift();

    if (task === undefined) {
      return false;
    }

    task();

    return true;
  };

  return {
    back: (): void => {
      requestTraversal(-1);
    },
    get entries(): readonly string[] {
      return entries.map(entry => entry.hash);
    },
    forward: (): void => {
      requestTraversal(1);
    },
    get goCalls(): readonly number[] {
      return goCalls;
    },
    get hash(): string {
      return readEntry().hash;
    },
    get index(): number {
      return index;
    },
    get isUnloaded(): boolean {
      return isUnloaded;
    },
    settle: (): void => {
      for (let steps = 0; steps < MAX_STEPS; steps += 1) {
        if (!step()) {
          return;
        }
      }

      throw new Error('The fake browser did not settle');
    },
    step,
    typeHash: (hash: string): void => {
      entries.splice(index + 1);
      entries.push({ hash, state: null });
      index += 1;
      mainTasks.push(() => {
        dispatch('popstate');
      });
      mainTasks.push(() => {
        dispatch('hashchange');
      });
    },
    window: fakeWindow as unknown as Window,
  };
};
