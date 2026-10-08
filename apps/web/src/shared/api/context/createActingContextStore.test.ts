import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createActingContextStore } from './createActingContextStore';

describe('createActingContextStore', () => {
  it('returns the initial context', () => {
    const store = createActingContextStore({ organizationId: 'org-1', userId: 'user-1' });

    expect(store.get()).toEqual({ organizationId: 'org-1', userId: 'user-1' });
  });

  it('replaces the context and notifies subscribers', () => {
    const store = createActingContextStore({ organizationId: undefined, userId: undefined });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ organizationId: 'org-2', userId: 'user-2' });

    expect(store.get()).toEqual({ organizationId: 'org-2', userId: 'user-2' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the same snapshot and stays silent when the context is unchanged', () => {
    const store = createActingContextStore({ organizationId: 'org-1', userId: 'user-1' });
    const listener = vi.fn();
    store.subscribe(listener);
    const snapshot = store.get();

    store.set({ organizationId: 'org-1', userId: 'user-1' });

    expect(store.get()).toBe(snapshot);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not notify unsubscribed listeners', () => {
    const store = createActingContextStore({ organizationId: undefined, userId: undefined });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.set({ organizationId: 'org-1', userId: undefined });

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not share state with the object passed in', () => {
    const initial = { organizationId: 'org-1', userId: 'user-1' };
    const store = createActingContextStore(initial);

    initial.organizationId = 'org-changed';

    expect(store.get().organizationId).toBe('org-1');
  });
});
