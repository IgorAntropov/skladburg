import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ACTING_CONTEXT_STORAGE_KEY,
  getTabStorage,
  persistActingContext,
  readPersistedActingContext,
  writePersistedActingContext,
} from './actingContextPersistence';
import { createActingContextStore } from './createActingContextStore';

const createMemoryStorage = (initial: Record<string, string> = {}): Storage => {
  const values = new Map<string, string>(Object.entries(initial));

  return {
    clear: () => {
      values.clear();
    },
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()].at(index) ?? null,
    get length(): number {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

const createFailingStorage = (failing: 'getItem' | 'setItem'): Storage => {
  const storage = createMemoryStorage();

  storage[failing] = () => {
    throw new DOMException('The storage is not available', 'SecurityError');
  };

  return storage;
};

const CONTEXT = { organizationId: 'org-1', userId: 'user-1' };

describe('getTabStorage', () => {
  it('returns the session storage of the window', () => {
    const sessionStorage = createMemoryStorage();

    expect(getTabStorage({ sessionStorage } as Window)).toBe(sessionStorage);
  });

  it('returns undefined when reading the storage throws', () => {
    const target = {
      get sessionStorage(): Storage {
        throw new DOMException('Access is denied', 'SecurityError');
      },
    } as Window;

    expect(getTabStorage(target)).toBeUndefined();
  });
});

describe('readPersistedActingContext', () => {
  it('reads the context written by writePersistedActingContext', () => {
    const storage = createMemoryStorage();

    writePersistedActingContext(storage, CONTEXT);

    expect(readPersistedActingContext(storage)).toEqual(CONTEXT);
  });

  it('returns undefined when nothing is stored', () => {
    expect(readPersistedActingContext(createMemoryStorage())).toBeUndefined();
  });

  it('returns undefined without a storage', () => {
    expect(readPersistedActingContext(undefined)).toBeUndefined();
  });

  it.each([
    ['broken JSON', '{"organizationId":'],
    ['not an object', '"org-1"'],
    ['null', 'null'],
    ['an array', '["org-1","user-1"]'],
    ['a missing user', '{"organizationId":"org-1"}'],
    ['a missing organization', '{"userId":"user-1"}'],
    ['numbers instead of strings', '{"organizationId":1,"userId":2}'],
    ['null fields', '{"organizationId":null,"userId":null}'],
    ['an empty organization', '{"organizationId":"","userId":"user-1"}'],
    ['an empty user', '{"organizationId":"org-1","userId":""}'],
  ])('returns undefined for %s', (_name, raw) => {
    const storage = createMemoryStorage({ [ACTING_CONTEXT_STORAGE_KEY]: raw });

    expect(readPersistedActingContext(storage)).toBeUndefined();
  });

  it('ignores extra fields', () => {
    const storage = createMemoryStorage({
      [ACTING_CONTEXT_STORAGE_KEY]: '{"organizationId":"org-1","userId":"user-1","extra":true}',
    });

    expect(readPersistedActingContext(storage)).toEqual(CONTEXT);
  });

  it('returns undefined when getItem throws', () => {
    expect(readPersistedActingContext(createFailingStorage('getItem'))).toBeUndefined();
  });
});

describe('writePersistedActingContext', () => {
  it('stores organization and user as JSON under the fixed key', () => {
    const storage = createMemoryStorage();

    writePersistedActingContext(storage, CONTEXT);

    expect(ACTING_CONTEXT_STORAGE_KEY).toBe('acting-context');
    expect(JSON.parse(storage.getItem(ACTING_CONTEXT_STORAGE_KEY) ?? 'null')).toEqual(CONTEXT);
  });

  it('does nothing without a storage', () => {
    expect(() => {
      writePersistedActingContext(undefined, CONTEXT);
    }).not.toThrow();
  });

  it('swallows an exception of setItem', () => {
    expect(() => {
      writePersistedActingContext(createFailingStorage('setItem'), CONTEXT);
    }).not.toThrow();
  });

  it('stores an incomplete context that is not read back', () => {
    const storage = createMemoryStorage();

    writePersistedActingContext(storage, { organizationId: 'org-1', userId: undefined });

    expect(readPersistedActingContext(storage)).toBeUndefined();
  });
});

describe('persistActingContext', () => {
  it('writes the current context at once', () => {
    const storage = createMemoryStorage();
    const store = createActingContextStore(CONTEXT);

    persistActingContext(store, storage);

    expect(readPersistedActingContext(storage)).toEqual(CONTEXT);
  });

  it('writes the context on every change of the store', () => {
    const storage = createMemoryStorage();
    const store = createActingContextStore(CONTEXT);
    persistActingContext(store, storage);

    store.set({ organizationId: 'org-2', userId: 'user-2' });

    expect(readPersistedActingContext(storage)).toEqual({ organizationId: 'org-2', userId: 'user-2' });
  });

  it('does not write again when the context is unchanged', () => {
    const storage = createMemoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const store = createActingContextStore(CONTEXT);
    persistActingContext(store, storage);

    store.set({ organizationId: 'org-1', userId: 'user-1' });

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('stops writing after the returned unsubscribe', () => {
    const storage = createMemoryStorage();
    const store = createActingContextStore(CONTEXT);
    const unsubscribe = persistActingContext(store, storage);

    unsubscribe();
    store.set({ organizationId: 'org-2', userId: 'user-2' });

    expect(readPersistedActingContext(storage)).toEqual(CONTEXT);
  });

  it('keeps the store working when the storage fails', () => {
    const store = createActingContextStore(CONTEXT);

    expect(() => {
      persistActingContext(store, createFailingStorage('setItem'));
      store.set({ organizationId: 'org-2', userId: 'user-2' });
    }).not.toThrow();
    expect(store.get()).toEqual({ organizationId: 'org-2', userId: 'user-2' });
  });

  it('works without a storage', () => {
    const store = createActingContextStore(CONTEXT);

    expect(() => {
      persistActingContext(store, undefined)();
    }).not.toThrow();
  });
});
