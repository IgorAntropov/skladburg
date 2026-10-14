import type {
  AppUpdateStateValue,
  AppUpdateStoreOptionsValue,
  IAppUpdateStore,
  IUpdatableRegistration,
  RegisterServiceWorkerFunction,
} from './appUpdateTypes';

export const UPDATE_CHECK_INTERVAL_MS = 3_600_000;

type UpdateServiceWorkerFunction = ReturnType<RegisterServiceWorkerFunction>;

export const createAppUpdateStore = ({
  isServiceWorkerSupported,
  reloadPage,
  visibility,
}: AppUpdateStoreOptionsValue): IAppUpdateStore => {
  const listeners = new Set<() => void>();

  let state: AppUpdateStateValue = 'idle';
  let updateServiceWorker: undefined | UpdateServiceWorkerFunction;
  let stopUpdateChecks: (() => void) | undefined;
  let isConnected = false;
  let isReleased = false;

  const setState = (next: AppUpdateStateValue): void => {
    if (state === next) {
      return;
    }

    state = next;
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const startUpdateChecks = (registration: IUpdatableRegistration): void => {
    stopUpdateChecks?.();

    const checkForUpdate = (): void => {
      registration.update().catch((error: unknown) => {
        console.log('> AppUpdateStore -> checkForUpdate:', { error });
      });
    };

    const handleVisibilityChange = (): void => {
      if (visibility.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    visibility.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

    stopUpdateChecks = (): void => {
      visibility.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
      stopUpdateChecks = undefined;
    };
  };

  const handleNeedRefresh = (): void => {
    if (isReleased) {
      return;
    }

    if (state === 'idle' || state === 'dismissed') {
      setState('ready');
    }
  };

  const handleNeedReload = (): void => {
    if (isReleased) {
      return;
    }

    if (state === 'applying') {
      reloadPage();
      return;
    }

    setState('reloadRequired');
  };

  const handleRegisteredServiceWorker = (
    scriptUrl: string,
    registration: IUpdatableRegistration | undefined,
  ): void => {
    if (isReleased || registration === undefined) {
      return;
    }

    startUpdateChecks(registration);
    console.log('> AppUpdateStore -> handleRegisteredServiceWorker:', { scriptUrl });
  };

  const handleRegisterError = (error: unknown): void => {
    console.log('> AppUpdateStore -> handleRegisterError:', { error });
    if (!isReleased && state !== 'reloadRequired') {
      setState('idle');
    }
  };

  const handleApplyFailure = (error: unknown): void => {
    console.log('> AppUpdateStore -> apply:', { error });
    if (!isReleased && state === 'applying') {
      setState('ready');
    }
  };

  return {
    apply: (): void => {
      if (state !== 'ready' || updateServiceWorker === undefined) {
        return;
      }

      setState('applying');
      updateServiceWorker(true).catch(handleApplyFailure);
    },
    connect: (register): void => {
      if (isConnected || isReleased) {
        return;
      }

      isConnected = true;

      if (!isServiceWorkerSupported) {
        console.log('> AppUpdateStore -> connect:', { isServiceWorkerSupported });
        return;
      }

      updateServiceWorker = register({
        immediate: true,
        onNeedRefresh: handleNeedRefresh,
        onNeedReload: handleNeedReload,
        onRegisteredSW: handleRegisteredServiceWorker,
        onRegisterError: handleRegisterError,
      });
    },
    dismiss: (): void => {
      if (state === 'ready') {
        setState('dismissed');
      }
    },
    getState: (): AppUpdateStateValue => state,
    release: (): void => {
      isReleased = true;
      stopUpdateChecks?.();
      listeners.clear();
      updateServiceWorker = undefined;
    },
    subscribe: (listener): (() => void) => {
      listeners.add(listener);

      return (): void => {
        listeners.delete(listener);
      };
    },
  };
};
