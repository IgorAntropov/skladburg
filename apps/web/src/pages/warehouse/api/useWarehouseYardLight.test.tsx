import type { GetWorldClockResponse } from '@skladburg/contracts/clock/v1/clock';
import type { RenderHookResult } from '@testing-library/react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
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
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';

import type { WorldClockReadingValue } from '@/widgets/top-bar';

import { ApiRuntimeProvider } from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { createWorldClockQueryOptions } from '@/widgets/top-bar';

import { useWarehouseYardLight } from './useWarehouseYardLight';

const AT_DUSK_MS = Date.UTC(2026, 10, 19, 15);
const BEFORE_DUSK_MS = AT_DUSK_MS - 1_000;
const BEFORE_DAWN_MS = Date.UTC(2026, 10, 20, 3) - 1_000;
const HOURS_12_MS = 43_200_000;

interface ClockControlValue {
  isFailing: boolean;
  reads: number;
  timeScale: number;
}

let isHidden = false;

const changeVisibility = (nextIsHidden: boolean): void => {
  act(() => {
    isHidden = nextIsHidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const advance = async (elapsedMs: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(elapsedMs);
  });
};

const mountLight = (
  timeScale: number,
  initialTimeMs: number = BEFORE_DUSK_MS,
  isEnabled = true,
  cachedReading?: WorldClockReadingValue,
): { clock: ClockControlValue; hook: RenderHookResult<boolean, boolean> } => {
  const clock = { isFailing: false, reads: 0, timeScale };
  const runtime = createTestRuntime({
    routes: router => router.service(ClockService, {
      getWorldClock: (): GetWorldClockResponse => {
        clock.reads += 1;
        if (clock.isFailing) {
          throw new ConnectError('Clock unavailable', Code.Unavailable);
        }

        return create(GetWorldClockResponseSchema, {
          timeScale: clock.timeScale,
          worldTime: timestampFromMs(Math.floor(initialTimeMs + performance.now() * clock.timeScale)),
        });
      },
    }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });
  if (cachedReading !== undefined) {
    client.setQueryData(createWorldClockQueryOptions(runtime.client).queryKey, cachedReading);
  }
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  const hook = renderHook(
    (isEnabled: boolean) => useWarehouseYardLight('Europe/Moscow', isEnabled),
    { initialProps: isEnabled, wrapper },
  );
  return { clock, hook };
};

beforeEach(() => {
  isHidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => isHidden);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('reads the authoritative time once at dusk and leaves the night quiet', async () => {
  const { clock, hook } = mountLight(1);
  await advance(0);
  expect(hook.result.current).toBe(false);
  expect(clock.reads).toBe(1);

  await advance(999);
  expect(clock.reads).toBe(1);
  await advance(2);
  expect(clock.reads).toBe(2);
  expect(hook.result.current).toBe(true);
  await advance(700);
  expect(clock.reads).toBe(2);
});

it('opens in the current phase with a cache entry from before dusk while WebGL prepares', async () => {
  await advance(2_000);
  const { clock, hook } = mountLight(1, BEFORE_DUSK_MS, false, {
    receivedAtMs: 0, snapshot: { timeScale: 1, worldTimeMs: BEFORE_DUSK_MS },
  });
  expect(hook.result.current).toBe(true);
  expect(clock.reads).toBe(0);

  hook.rerender(true);
  await advance(1);
  expect(hook.result.current).toBe(true);
  expect(clock.reads).toBe(1);
});

it('suspends the scheduled boundary in the background and when 3D is off', async () => {
  const { clock, hook } = mountLight(1, BEFORE_DUSK_MS, false);
  await advance(0);
  expect(clock.reads).toBe(0);
  expect(hook.result.current).toBe(false);

  hook.rerender(true);
  await advance(0);
  changeVisibility(true);
  await advance(5000);
  expect(clock.reads).toBe(1);
  expect(hook.result.current).toBe(false);

  changeVisibility(false);
  await advance(1);
  expect(clock.reads).toBe(2);
  expect(hook.result.current).toBe(true);

  hook.rerender(false);
  await advance(HOURS_12_MS);
  expect(clock.reads).toBe(2);
});

it('does not schedule a boundary while the world is paused', async () => {
  const { clock, hook } = mountLight(0);
  await advance(0);
  await advance(HOURS_12_MS);
  expect(clock.reads).toBe(1);
  expect(hook.result.current).toBe(false);
});

it('keeps the last phase when the boundary read fails and retries without guessing', async () => {
  const { clock, hook } = mountLight(1, BEFORE_DAWN_MS);
  await advance(0);
  expect(hook.result.current).toBe(true);
  clock.isFailing = true;
  await advance(1001);
  expect(clock.reads).toBe(2);
  expect(hook.result.current).toBe(true);

  clock.isFailing = false;
  await advance(5001);
  expect(clock.reads).toBe(3);
  expect(hook.result.current).toBe(false);
});
