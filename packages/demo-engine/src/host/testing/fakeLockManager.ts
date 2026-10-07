import type {
  ILockManager,
  LockRequestOptionsValue,
} from '../hostTypes';

export interface FakeLockManagerValue extends ILockManager {
  forceRelease: (name: string) => boolean;
  isHeld: (name: string) => boolean;
  occupy: (name: string) => () => void;
  requestedNames: () => readonly string[];
  waitingCount: (name: string) => number;
}

interface LockHolderValue {
  name: string;
}

interface LockStateValue {
  holder: LockHolderValue | undefined;
  waiters: LockWaiterValue[];
}

interface LockWaiterValue {
  callback: () => Promise<void>;
  reject: (reason: unknown) => void;
  resolve: () => void;
}

const createAbortError = (): Error => new DOMException('The lock request was aborted', 'AbortError');

export const createFakeLockManager = (): FakeLockManagerValue => {
  const states = new Map<string, LockStateValue>();
  const requested: string[] = [];

  const readState = (name: string): LockStateValue => {
    const existing = states.get(name);

    if (existing !== undefined) {
      return existing;
    }

    const created: LockStateValue = { holder: undefined, waiters: [] };
    states.set(name, created);

    return created;
  };

  const grantNext = (name: string): void => {
    const state = readState(name);

    if (state.holder !== undefined) {
      return;
    }

    const waiter = state.waiters.shift();

    if (waiter === undefined) {
      return;
    }

    const holder: LockHolderValue = { name };
    state.holder = holder;

    void Promise.resolve()
      .then(waiter.callback)
      .then(waiter.resolve, waiter.reject)
      .finally(() => {
        if (state.holder === holder) {
          state.holder = undefined;
          grantNext(name);
        }
      });
  };

  const request = (name: string, options: LockRequestOptionsValue, callback: () => Promise<void>): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      requested.push(name);

      if (options.signal.aborted) {
        reject(createAbortError());

        return;
      }

      const state = readState(name);
      const waiter: LockWaiterValue = { callback, reject, resolve };

      const handleAbort = (): void => {
        const index = state.waiters.indexOf(waiter);

        if (index >= 0) {
          state.waiters.splice(index, 1);
          reject(createAbortError());
        }
      };

      options.signal.addEventListener('abort', handleAbort, { once: true });
      state.waiters.push(waiter);
      grantNext(name);
    });

  const forceRelease = (name: string): boolean => {
    const state = readState(name);

    if (state.holder === undefined) {
      return false;
    }

    state.holder = undefined;
    grantNext(name);

    return true;
  };

  const occupy = (name: string): (() => void) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    void request(name, { signal: new AbortController().signal }, () => held);

    return release;
  };

  return {
    forceRelease,
    isHeld: name => readState(name).holder !== undefined,
    occupy,
    request,
    requestedNames: () => requested,
    waitingCount: name => readState(name).waiters.length,
  };
};
