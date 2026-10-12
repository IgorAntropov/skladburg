import type { ConnectRouter } from '@connectrpc/connect';
import type { GetWorldClockResponse } from '@skladburg/contracts/clock/v1/clock';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ClockService,
  GetWorldClockResponseSchema,
} from '@skladburg/contracts/clock/v1/clock';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ILocalizer } from '@/shared/i18n';

import { ApiRuntimeProvider } from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';

import type {
  WorldClockRoutesOptionsValue,
  WorldClockRoutesValue,
} from '../lib/testing/worldClockHarness';

import {
  createUnavailableFailure,
  createWorldClockRoutes,
  WORLD_MINUTE_START_MS,
  WORLD_START_MS,
} from '../lib/testing/worldClockHarness';
import { WorldClock } from './WorldClock';

const MINUTE_MS = 60_000;
const CLOCK_TEST_ID = 'top-bar-clock-slot';

let visibilityState: DocumentVisibilityState = 'visible';

const createClockLocalizer = (userTimeZone: string): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone,
});

const flushPromises = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const changeVisibility = (nextState: DocumentVisibilityState): void => {
  visibilityState = nextState;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  });
};

interface RenderClockOptionsValue extends WorldClockRoutesOptionsValue {
  routes?: ((router: ConnectRouter) => void) | undefined;
  userTimeZone?: string;
}

interface SwitchableFailureRoutesValue {
  getFailedCallCount: () => number;
  routes: (router: ConnectRouter) => void;
  startFailing: () => void;
}

const createSwitchableFailureRoutes = (): SwitchableFailureRoutesValue => {
  let isFailing = false;
  let failedCallCount = 0;

  const routes = (router: ConnectRouter): void => {
    router.service(ClockService, {
      getWorldClock: (): GetWorldClockResponse => {
        if (isFailing) {
          failedCallCount += 1;
          throw createUnavailableFailure();
        }

        return create(GetWorldClockResponseSchema, {
          timeScale: 1,
          worldTime: timestampFromMs(Math.round(WORLD_START_MS + performance.now())),
        });
      },
    });
  };

  return {
    getFailedCallCount: () => failedCallCount,
    routes,
    startFailing: () => {
      isFailing = true;
    },
  };
};

const renderClock = async (
  { routes, userTimeZone = 'UTC', ...routesOptions }: RenderClockOptionsValue = {},
): Promise<WorldClockRoutesValue> => {
  const clockRoutes = createWorldClockRoutes(routesOptions);
  const runtime = createTestRuntime({ routes: routes ?? clockRoutes.routes });
  const localizer = await createClockLocalizer(userTimeZone);
  const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });

  const tree: ReactElement = (
    <LocalizerProvider localizer={localizer}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <WorldClock />
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LocalizerProvider>
  );

  render(tree);
  await flushPromises();

  return clockRoutes;
};

const getTime = (): HTMLTimeElement => {
  const time = screen.getByTestId(CLOCK_TEST_ID).querySelector('time');

  if (time === null) {
    throw new Error('time element is missing');
  }

  return time;
};

describe('WorldClock', () => {
  beforeEach(() => {
    visibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('loading', () => {
    it('replaces the skeleton with the time when the answer comes', async () => {
      await renderClock();

      expect(screen.queryByRole('status')).toBeNull();
      expect(getTime().textContent).toBe('12:07');
    });
  });

  describe('time', () => {
    it('shows hours and minutes of the world in the time zone of the user', async () => {
      await renderClock({ userTimeZone: 'Europe/Moscow' });

      expect(getTime().textContent).toBe('15:07');
    });

    it('gives the machine readable minute in UTC regardless of the time zone of the user', async () => {
      await renderClock({ userTimeZone: 'Asia/Vladivostok' });

      expect(getTime().textContent).toBe('22:07');
      expect(getTime().getAttribute('datetime')).toBe(new Date(WORLD_MINUTE_START_MS).toISOString());
    });

    it('changes the text exactly once when the minute of the world changes at the scale 1', async () => {
      await renderClock();
      const observer = new MutationObserver(() => undefined);
      observer.observe(getTime(), { characterData: true, childList: true, subtree: true });

      advance(39_999);
      expect(observer.takeRecords()).toHaveLength(0);
      expect(getTime().textContent).toBe('12:07');

      advance(1);
      expect(getTime().textContent).toBe('12:08');
      expect(observer.takeRecords().length).toBeGreaterThan(0);

      advance(MINUTE_MS - 1);
      expect(observer.takeRecords()).toHaveLength(0);
      observer.disconnect();
    });

    it('moves the minute every second of the real time at the scale 60', async () => {
      await renderClock({ timeScale: 60, worldStartMs: WORLD_MINUTE_START_MS });
      const seen = [getTime().textContent];

      for (let second = 0; second < 3; second += 1) {
        advance(1000);
        seen.push(getTime().textContent);
      }

      expect(seen).toEqual(['12:07', '12:08', '12:09', '12:10']);
    });

    it('keeps the time still at the scale 0', async () => {
      await renderClock({ timeScale: 0 });

      advance(10 * MINUTE_MS);

      expect(getTime().textContent).toBe('12:07');
    });
  });

  describe('hidden tab', () => {
    it('keeps the text while the tab is hidden', async () => {
      await renderClock();

      changeVisibility('hidden');
      advance(10 * MINUTE_MS);

      expect(getTime().textContent).toBe('12:07');
    });

    it('shows the right time at once when the tab is visible again', async () => {
      await renderClock();

      changeVisibility('hidden');
      advance(10 * MINUTE_MS);
      changeVisibility('visible');

      expect(getTime().textContent).toBe('12:17');
    });

    it('asks the answer again when the tab is visible again even if the answer is fresh', async () => {
      const { getCallCount } = await renderClock();
      expect(getCallCount()).toBe(1);

      changeVisibility('hidden');
      changeVisibility('visible');
      await flushPromises();

      expect(getCallCount()).toBe(2);
    });
  });

  describe('failure', () => {
    it('draws nothing when the answer is an error', async () => {
      await renderClock({ failure: createUnavailableFailure() });

      expect(screen.queryByTestId(CLOCK_TEST_ID)).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('keeps the time in place when the repeated request fails and the earlier answer is there', async () => {
      const { getFailedCallCount, routes, startFailing } = createSwitchableFailureRoutes();
      await renderClock({ routes });
      expect(getTime().textContent).toBe('12:07');

      startFailing();
      changeVisibility('hidden');
      advance(10 * MINUTE_MS);
      changeVisibility('visible');
      await flushPromises();

      expect(getFailedCallCount()).toBe(1);
      expect(screen.getByTestId(CLOCK_TEST_ID)).toBeDefined();
      expect(getTime().textContent).toBe('12:17');
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('logs the error once', async () => {
      await renderClock({ failure: createUnavailableFailure() });

      advance(10 * MINUTE_MS);
      await flushPromises();

      const clockLogs = vi.mocked(console.log).mock.calls.filter(([message]) => message === '> WorldClock -> reportClockError:');

      expect(clockLogs).toHaveLength(1);
    });

    it('does not log anything on success', async () => {
      await renderClock();

      advance(10 * MINUTE_MS);

      const clockLogs = vi.mocked(console.log).mock.calls.filter(([message]) => String(message).startsWith('> WorldClock'));

      expect(clockLogs).toHaveLength(0);
    });
  });
});
