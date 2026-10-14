import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  IAppUpdateStore,
  IUpdatableRegistration,
  IVisibilitySource,
  RegisterServiceWorkerFunction,
  ServiceWorkerRegistrationOptionsValue,
} from './appUpdateTypes';

import {
  createAppUpdateStore,
  UPDATE_CHECK_INTERVAL_MS,
} from './createAppUpdateStore';

interface FakeRegistrationValue {
  registration: IUpdatableRegistration;
  update: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

class FakeVisibility implements IVisibilitySource {
  visibilityState: DocumentVisibilityState = 'visible';

  private readonly target = new EventTarget();
  private readonly wrappers = new Map<() => void, EventListener>();

  addEventListener(type: 'visibilitychange', listener: () => void): void {
    const wrapper: EventListener = () => {
      listener();
    };

    this.wrappers.set(listener, wrapper);
    this.target.addEventListener(type, wrapper);
  }

  change(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.target.dispatchEvent(new Event('visibilitychange'));
  }

  removeEventListener(type: 'visibilitychange', listener: () => void): void {
    const wrapper = this.wrappers.get(listener);

    if (wrapper !== undefined) {
      this.target.removeEventListener(type, wrapper);
      this.wrappers.delete(listener);
    }
  }
}

const createFakeRegistration = (): FakeRegistrationValue => {
  const update = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const registration: IUpdatableRegistration = { update };

  return { registration, update };
};

interface SetupValue {
  register: ReturnType<typeof vi.fn<RegisterServiceWorkerFunction>>;
  reloadPage: ReturnType<typeof vi.fn<() => void>>;
  requireCallbacks: () => ServiceWorkerRegistrationOptionsValue;
  store: IAppUpdateStore;
  updateServiceWorker: ReturnType<typeof vi.fn<(shouldReloadPage?: boolean) => Promise<void>>>;
  visibility: FakeVisibility;
}

const setup = (options: { isServiceWorkerSupported?: boolean } = {}): SetupValue => {
  const visibility = new FakeVisibility();
  const reloadPage = vi.fn<() => void>();
  const store = createAppUpdateStore({
    isServiceWorkerSupported: options.isServiceWorkerSupported ?? true,
    reloadPage,
    visibility,
  });
  const updateServiceWorker = vi.fn<(shouldReloadPage?: boolean) => Promise<void>>(() => Promise.resolve());
  let callbacks: ServiceWorkerRegistrationOptionsValue | undefined;
  const register = vi.fn<RegisterServiceWorkerFunction>((registerOptions) => {
    callbacks = registerOptions;

    return updateServiceWorker;
  });

  const requireCallbacks = (): ServiceWorkerRegistrationOptionsValue => {
    if (callbacks === undefined) {
      throw new Error('register was not called');
    }

    return callbacks;
  };

  return {
    register,
    reloadPage,
    requireCallbacks,
    store,
    updateServiceWorker,
    visibility,
  };
};

describe('createAppUpdateStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('states', () => {
    it('starts idle and registers with immediate checks', () => {
      const { register, requireCallbacks, store } = setup();

      expect(store.getState()).toBe('idle');

      store.connect(register);

      expect(register).toHaveBeenCalledTimes(1);
      expect(requireCallbacks().immediate).toBe(true);
      expect(store.getState()).toBe('idle');
    });

    it('becomes ready when a new version is waiting and notifies subscribers once', () => {
      const { register, requireCallbacks, store } = setup();
      const listener = vi.fn();
      store.subscribe(listener);
      store.connect(register);

      requireCallbacks().onNeedRefresh();
      requireCallbacks().onNeedRefresh();

      expect(store.getState()).toBe('ready');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const { register, requireCallbacks, store } = setup();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      store.connect(register);

      unsubscribe();
      requireCallbacks().onNeedRefresh();

      expect(listener).not.toHaveBeenCalled();
    });

    it('dismisses only a ready notice', () => {
      const { register, requireCallbacks, store } = setup();
      store.connect(register);

      store.dismiss();
      expect(store.getState()).toBe('idle');

      requireCallbacks().onNeedRefresh();
      store.dismiss();
      expect(store.getState()).toBe('dismissed');
    });

    it('becomes ready again when another new version arrives after dismissal', () => {
      const { register, requireCallbacks, store } = setup();
      store.connect(register);
      requireCallbacks().onNeedRefresh();
      store.dismiss();

      requireCallbacks().onNeedRefresh();

      expect(store.getState()).toBe('ready');
    });

    it('applies a ready update through the service worker and waits for the reload', () => {
      const { register, requireCallbacks, store, updateServiceWorker } = setup();
      store.connect(register);
      requireCallbacks().onNeedRefresh();

      store.apply();

      expect(store.getState()).toBe('applying');
      expect(updateServiceWorker).toHaveBeenCalledWith(true);
    });

    it('ignores apply when nothing is ready or already applying', () => {
      const { register, requireCallbacks, store, updateServiceWorker } = setup();
      store.connect(register);

      store.apply();
      expect(updateServiceWorker).not.toHaveBeenCalled();

      requireCallbacks().onNeedRefresh();
      store.apply();
      store.apply();
      expect(updateServiceWorker).toHaveBeenCalledTimes(1);
    });

    it('does not leave applying through dismiss or a repeated new version', () => {
      const { register, requireCallbacks, store } = setup();
      store.connect(register);
      requireCallbacks().onNeedRefresh();
      store.apply();

      store.dismiss();
      requireCallbacks().onNeedRefresh();

      expect(store.getState()).toBe('applying');
    });

    it('returns to ready when applying fails', async () => {
      const { register, requireCallbacks, store, updateServiceWorker } = setup();
      updateServiceWorker.mockRejectedValueOnce(new Error('no worker'));
      store.connect(register);
      requireCallbacks().onNeedRefresh();

      store.apply();
      expect(store.getState()).toBe('applying');
      await vi.advanceTimersByTimeAsync(0);

      expect(store.getState()).toBe('ready');
    });
  });

  describe('reload requested by the service worker', () => {
    it('reloads the page when this tab is applying the update', () => {
      const { register, reloadPage, requireCallbacks, store } = setup();
      store.connect(register);
      requireCallbacks().onNeedRefresh();
      store.apply();

      requireCallbacks().onNeedReload();

      expect(reloadPage).toHaveBeenCalledTimes(1);
      expect(store.getState()).toBe('applying');
    });

    it('asks for a reload instead of reloading from idle', () => {
      const { register, reloadPage, requireCallbacks, store } = setup();
      const listener = vi.fn();
      store.subscribe(listener);
      store.connect(register);

      requireCallbacks().onNeedReload();

      expect(store.getState()).toBe('reloadRequired');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(reloadPage).not.toHaveBeenCalled();
    });

    it('asks for a reload instead of reloading from ready', () => {
      const { register, reloadPage, requireCallbacks, store } = setup();
      store.connect(register);
      requireCallbacks().onNeedRefresh();

      requireCallbacks().onNeedReload();

      expect(store.getState()).toBe('reloadRequired');
      expect(reloadPage).not.toHaveBeenCalled();
    });

    it('asks for a reload instead of reloading from dismissed', () => {
      const { register, reloadPage, requireCallbacks, store } = setup();
      store.connect(register);
      requireCallbacks().onNeedRefresh();
      store.dismiss();

      requireCallbacks().onNeedReload();

      expect(store.getState()).toBe('reloadRequired');
      expect(reloadPage).not.toHaveBeenCalled();
    });

    it('stays in reloadRequired whatever happens next', async () => {
      const {
        register,
        reloadPage,
        requireCallbacks,
        store,
        updateServiceWorker,
      } = setup();
      store.connect(register);
      requireCallbacks().onNeedReload();

      store.apply();
      store.dismiss();
      requireCallbacks().onNeedRefresh();
      requireCallbacks().onRegisterError(new Error('late'));
      requireCallbacks().onNeedReload();
      await vi.advanceTimersByTimeAsync(0);

      expect(store.getState()).toBe('reloadRequired');
      expect(updateServiceWorker).not.toHaveBeenCalled();
      expect(reloadPage).not.toHaveBeenCalled();
    });

    it('ignores a late reload request after release', () => {
      const { register, reloadPage, requireCallbacks, store } = setup();
      const listener = vi.fn();
      store.subscribe(listener);
      store.connect(register);
      requireCallbacks().onNeedRefresh();
      store.apply();
      listener.mockClear();

      store.release();
      requireCallbacks().onNeedReload();

      expect(reloadPage).not.toHaveBeenCalled();
      expect(store.getState()).toBe('applying');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('without a service worker', () => {
    it('stays idle and does not register', () => {
      const { register, store } = setup({ isServiceWorkerSupported: false });

      store.connect(register);
      store.apply();
      store.dismiss();

      expect(register).not.toHaveBeenCalled();
      expect(store.getState()).toBe('idle');
    });
  });

  describe('registration errors', () => {
    it('stays idle and keeps working', () => {
      const { register, requireCallbacks, store } = setup();
      store.connect(register);

      requireCallbacks().onRegisterError(new Error('denied'));

      expect(store.getState()).toBe('idle');
    });

    it('registers only once', () => {
      const { register, store } = setup();

      store.connect(register);
      store.connect(register);

      expect(register).toHaveBeenCalledTimes(1);
    });
  });

  describe('update checks', () => {
    it('does nothing until the registration is known', () => {
      const { register, store, visibility } = setup();
      store.connect(register);

      visibility.change('visible');
      vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);

      expect(store.getState()).toBe('idle');
    });

    it('checks when the tab becomes visible and not when it hides', () => {
      const { register, requireCallbacks, store, visibility } = setup();
      const { registration, update } = createFakeRegistration();
      store.connect(register);
      requireCallbacks().onRegisteredSW('/sw.js', registration);

      visibility.change('hidden');
      expect(update).not.toHaveBeenCalled();

      visibility.change('visible');
      expect(update).toHaveBeenCalledTimes(1);
    });

    it('checks every interval', () => {
      const { register, requireCallbacks, store } = setup();
      const { registration, update } = createFakeRegistration();
      store.connect(register);
      requireCallbacks().onRegisteredSW('/sw.js', registration);

      vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS - 1);
      expect(update).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(update).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
      expect(update).toHaveBeenCalledTimes(2);
    });

    it('ignores a missing registration', () => {
      const { register, requireCallbacks, store, visibility } = setup();
      store.connect(register);

      requireCallbacks().onRegisteredSW('/sw.js', undefined);
      visibility.change('visible');
      vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);

      expect(vi.getTimerCount()).toBe(0);
    });

    it('survives an offline check without changing state', async () => {
      const { register, requireCallbacks, store, visibility } = setup();
      const { registration, update } = createFakeRegistration();
      update.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      store.connect(register);
      requireCallbacks().onRegisteredSW('/sw.js', registration);
      requireCallbacks().onNeedRefresh();

      visibility.change('visible');
      await vi.advanceTimersByTimeAsync(0);

      expect(store.getState()).toBe('ready');
    });

    it('replaces the previous checks when registered again', () => {
      const { register, requireCallbacks, store, visibility } = setup();
      const first = createFakeRegistration();
      const second = createFakeRegistration();
      store.connect(register);
      requireCallbacks().onRegisteredSW('/sw.js', first.registration);
      requireCallbacks().onRegisteredSW('/sw.js', second.registration);

      visibility.change('visible');

      expect(first.update).not.toHaveBeenCalled();
      expect(second.update).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe('release', () => {
    it('removes the visibility listener and the timer', () => {
      const { register, requireCallbacks, store, visibility } = setup();
      const { registration, update } = createFakeRegistration();
      store.connect(register);
      requireCallbacks().onRegisteredSW('/sw.js', registration);

      store.release();
      visibility.change('visible');
      vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2);

      expect(update).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('drops subscribers and ignores late callbacks', () => {
      const { register, requireCallbacks, store } = setup();
      const listener = vi.fn();
      store.subscribe(listener);
      store.connect(register);

      store.release();
      requireCallbacks().onNeedRefresh();

      expect(store.getState()).toBe('idle');
      expect(listener).not.toHaveBeenCalled();
    });

    it('does not register after release', () => {
      const { register, store } = setup();

      store.release();
      store.connect(register);

      expect(register).not.toHaveBeenCalled();
    });

    it('does not touch the state when applying fails after release', async () => {
      const { register, requireCallbacks, store, updateServiceWorker } = setup();
      updateServiceWorker.mockRejectedValueOnce(new Error('late'));
      store.connect(register);
      requireCallbacks().onNeedRefresh();
      store.apply();

      store.release();
      await vi.advanceTimersByTimeAsync(0);

      expect(store.getState()).toBe('applying');
    });
  });
});
