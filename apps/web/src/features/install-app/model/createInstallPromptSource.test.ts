import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  BeforeInstallPromptEventValue,
  IDisplayModeQuery,
  IInstallPromptSource,
  IInstallWindow,
} from './installTypes';

import { createInstallPromptSource } from './createInstallPromptSource';

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '
  + 'Version/18.1 Mobile/15E148 Safari/604.1';

interface FakeInstallEventValue {
  event: BeforeInstallPromptEventValue;
  prompt: ReturnType<typeof vi.fn<() => Promise<void>>>;
  resolveChoice: (outcome: string) => void;
}

class FakeDisplayModeQuery implements IDisplayModeQuery {
  matches = false;

  private readonly listeners = new Set<() => void>();

  addEventListener(_type: 'change', listener: () => void): void {
    this.listeners.add(listener);
  }

  change(matches: boolean): void {
    this.matches = matches;

    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

class FakeWindow implements IInstallWindow {
  readonly displayMode = new FakeDisplayModeQuery();
  navigator: { maxTouchPoints: number; standalone?: boolean; userAgent: string } = {
    maxTouchPoints: 0,
    userAgent: CHROME_WINDOWS,
  };

  private readonly target = new EventTarget();

  addEventListener(type: 'appinstalled' | 'beforeinstallprompt', listener: (event: Event) => void): void {
    this.target.addEventListener(type, listener);
  }

  dispatch(event: Event): void {
    this.target.dispatchEvent(event);
  }

  matchMedia: IInstallWindow['matchMedia'] = () => this.displayMode;
}

const createInstallEvent = (): FakeInstallEventValue => {
  let resolveChoice: (outcome: string) => void = () => undefined;
  const userChoice = new Promise<{ outcome: string }>((resolve) => {
    resolveChoice = (outcome) => {
      resolve({ outcome });
    };
  });
  const prompt = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice });

  return { event, prompt, resolveChoice };
};

interface SetupValue {
  fakeWindow: FakeWindow;
  listener: ReturnType<typeof vi.fn<() => void>>;
  source: IInstallPromptSource;
}

const setup = (configure: (fakeWindow: FakeWindow) => void = () => undefined): SetupValue => {
  const fakeWindow = new FakeWindow();

  configure(fakeWindow);

  const source = createInstallPromptSource(fakeWindow);
  const listener = vi.fn<() => void>();

  source.subscribe(listener);

  return { fakeWindow, listener, source };
};

describe('createInstallPromptSource', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts unavailable in a browser without the install event', () => {
    const { source } = setup();

    expect(source.getMode()).toBe('unavailable');
  });

  it('starts with instructions on an iPhone', () => {
    const { source } = setup((fakeWindow) => {
      fakeWindow.navigator = { maxTouchPoints: 5, userAgent: IPHONE_SAFARI };
    });

    expect(source.getMode()).toBe('instructions');
  });

  it('starts installed when the app is already running standalone', () => {
    const { source } = setup((fakeWindow) => {
      fakeWindow.displayMode.matches = true;
    });

    expect(source.getMode()).toBe('installed');
  });

  it('starts installed when the iOS standalone flag is set', () => {
    const { source } = setup((fakeWindow) => {
      fakeWindow.navigator = { maxTouchPoints: 5, standalone: true, userAgent: IPHONE_SAFARI };
    });

    expect(source.getMode()).toBe('installed');
  });

  it('works without matchMedia', () => {
    const { source } = setup((fakeWindow) => {
      fakeWindow.matchMedia = undefined;
    });

    expect(source.getMode()).toBe('unavailable');
  });

  it('holds back the install event with preventDefault and switches to the prompt mode', () => {
    const { fakeWindow, listener, source } = setup();
    const { event } = createInstallEvent();

    fakeWindow.dispatch(event);

    expect(event.defaultPrevented).toBe(true);
    expect(source.getMode()).toBe('prompt');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores a foreign event of the same name but still prevents its default', () => {
    const { fakeWindow, listener, source } = setup();
    const event = new Event('beforeinstallprompt', { cancelable: true });

    fakeWindow.dispatch(event);

    expect(event.defaultPrevented).toBe(true);
    expect(source.getMode()).toBe('unavailable');
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns the unavailable outcome without throwing when there is no event', async () => {
    const { source } = setup();

    await expect(source.prompt()).resolves.toBe('unavailable');
  });

  it('shows the system dialog, returns the outcome and drops the used event', async () => {
    const { fakeWindow, listener, source } = setup();
    const { event, prompt, resolveChoice } = createInstallEvent();

    fakeWindow.dispatch(event);
    listener.mockClear();

    const outcome = source.prompt();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(source.getMode()).toBe('prompt');

    resolveChoice('accepted');

    await expect(outcome).resolves.toBe('accepted');
    expect(source.getMode()).toBe('unavailable');
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(source.prompt()).resolves.toBe('unavailable');
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('returns the dismissed outcome when the user declines', async () => {
    const { fakeWindow, source } = setup();
    const { event, resolveChoice } = createInstallEvent();

    fakeWindow.dispatch(event);

    const outcome = source.prompt();

    resolveChoice('dismissed');

    await expect(outcome).resolves.toBe('dismissed');
    expect(source.getMode()).toBe('unavailable');
  });

  it('shows the dialog once for a repeated call while the first one is open', async () => {
    const { fakeWindow, source } = setup();
    const { event, prompt, resolveChoice } = createInstallEvent();

    fakeWindow.dispatch(event);

    const first = source.prompt();
    const second = source.prompt();

    resolveChoice('accepted');

    await expect(first).resolves.toBe('accepted');
    await expect(second).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('accepts a fresh event after the previous one was used', async () => {
    const { fakeWindow, source } = setup();
    const first = createInstallEvent();
    const second = createInstallEvent();

    fakeWindow.dispatch(first.event);
    first.resolveChoice('dismissed');
    await source.prompt();
    fakeWindow.dispatch(second.event);

    expect(source.getMode()).toBe('prompt');

    second.resolveChoice('accepted');

    await expect(source.prompt()).resolves.toBe('accepted');
  });

  it('logs a failing prompt, returns the unavailable outcome and drops the event', async () => {
    const { fakeWindow, source } = setup();
    const { event, prompt } = createInstallEvent();
    const error = new DOMException('already used', 'InvalidStateError');

    prompt.mockRejectedValueOnce(error);
    fakeWindow.dispatch(event);

    await expect(source.prompt()).resolves.toBe('unavailable');
    expect(console.error).toHaveBeenCalledWith('> InstallPromptSource -> prompt:', { error });
    expect(source.getMode()).toBe('unavailable');
    await expect(source.prompt()).resolves.toBe('unavailable');
  });

  it('recovers after a prompt that throws synchronously', async () => {
    const { fakeWindow, source } = setup();
    const failing = createInstallEvent();
    const next = createInstallEvent();

    failing.prompt.mockImplementationOnce(() => {
      throw new DOMException('already used', 'InvalidStateError');
    });
    fakeWindow.dispatch(failing.event);

    await expect(source.prompt()).resolves.toBe('unavailable');
    fakeWindow.dispatch(next.event);
    next.resolveChoice('accepted');

    await expect(source.prompt()).resolves.toBe('accepted');
    expect(next.prompt).toHaveBeenCalledTimes(1);
  });

  it('switches to installed and drops the event on appinstalled', () => {
    const { fakeWindow, listener, source } = setup();

    fakeWindow.dispatch(createInstallEvent().event);
    listener.mockClear();
    fakeWindow.dispatch(new Event('appinstalled'));

    expect(source.getMode()).toBe('installed');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('follows the display-mode change', () => {
    const { fakeWindow, listener, source } = setup();

    fakeWindow.displayMode.change(true);

    expect(source.getMode()).toBe('installed');
    expect(listener).toHaveBeenCalledTimes(1);

    fakeWindow.displayMode.change(false);

    expect(source.getMode()).toBe('unavailable');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when the mode stays the same', () => {
    const { fakeWindow, listener } = setup();

    fakeWindow.displayMode.change(false);

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const { fakeWindow, listener, source } = setup();
    const secondListener = vi.fn<() => void>();
    const unsubscribeSecond = source.subscribe(secondListener);

    unsubscribeSecond();
    fakeWindow.dispatch(createInstallEvent().event);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(secondListener).not.toHaveBeenCalled();
  });
});
