import type {
  BeforeInstallPromptEventValue,
  IInstallPromptSource,
  IInstallWindow,
  InstallModeValue,
  InstallPromptOutcomeValue,
} from './installTypes';

import { resolveInstallMode } from './resolveInstallMode';

const STANDALONE_DISPLAY_MODE_QUERY = '(display-mode: standalone)';

const isBeforeInstallPromptEvent = (event: Event): event is BeforeInstallPromptEventValue => {
  return 'prompt' in event && typeof event.prompt === 'function' && 'userChoice' in event;
};

export const createInstallPromptSource = (target: IInstallWindow): IInstallPromptSource => {
  const standaloneQuery = typeof target.matchMedia === 'function'
    ? target.matchMedia(STANDALONE_DISPLAY_MODE_QUERY)
    : undefined;
  const listeners = new Set<() => void>();

  let deferredEvent: BeforeInstallPromptEventValue | undefined;
  let pendingPrompt: Promise<InstallPromptOutcomeValue> | undefined;
  let isInstalled = false;

  const readMode = (): InstallModeValue => {
    const { maxTouchPoints, standalone, userAgent } = target.navigator;

    return resolveInstallMode({
      hasDeferredPrompt: deferredEvent !== undefined,
      isStandalone: isInstalled || standaloneQuery?.matches === true || standalone === true,
      maxTouchPoints,
      userAgent,
    });
  };

  let mode = readMode();

  const refresh = (): void => {
    const nextMode = readMode();

    if (nextMode === mode) {
      return;
    }

    mode = nextMode;

    for (const listener of [...listeners]) {
      listener();
    }
  };

  const handleBeforeInstallPrompt = (event: Event): void => {
    event.preventDefault();

    if (isBeforeInstallPromptEvent(event)) {
      deferredEvent = event;
      refresh();
    }
  };

  const handleAppInstalled = (): void => {
    deferredEvent = undefined;
    isInstalled = true;
    refresh();
  };

  const handleDisplayModeChange = (): void => {
    refresh();
  };

  const runPrompt = async (event: BeforeInstallPromptEventValue): Promise<InstallPromptOutcomeValue> => {
    try {
      await event.prompt();

      const choice = await event.userChoice;
      const outcome: InstallPromptOutcomeValue = choice.outcome === 'accepted' ? 'accepted' : 'dismissed';

      console.log('> InstallPromptSource -> prompt:', { outcome });

      return outcome;
    }
    catch (error) {
      console.error('> InstallPromptSource -> prompt:', { error });

      return 'unavailable';
    }
  };

  const settlePrompt = (event: BeforeInstallPromptEventValue, outcome: InstallPromptOutcomeValue): InstallPromptOutcomeValue => {
    if (deferredEvent === event) {
      deferredEvent = undefined;
    }

    pendingPrompt = undefined;
    refresh();

    return outcome;
  };

  const prompt = (): Promise<InstallPromptOutcomeValue> => {
    if (pendingPrompt !== undefined) {
      return pendingPrompt;
    }

    if (deferredEvent === undefined) {
      return Promise.resolve('unavailable');
    }

    const event = deferredEvent;

    pendingPrompt = runPrompt(event).then(outcome => settlePrompt(event, outcome));

    return pendingPrompt;
  };

  target.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  target.addEventListener('appinstalled', handleAppInstalled);
  standaloneQuery?.addEventListener('change', handleDisplayModeChange);

  return {
    getMode: () => mode,
    prompt,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
