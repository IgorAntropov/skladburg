import type { Client } from '@connectrpc/connect';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import {
  ClockService,
  type GetWorldClockResponse,
} from '@skladburg/contracts/clock/v1/clock';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IClock } from '../../ports/index';

import { createScaledClock } from '../../ports/index';
import {
  SEED_WORLD_START_MS,
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/index';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { createClockService } from './clockService';

const readWorldMs = (response: GetWorldClockResponse): number =>
  response.worldTime === undefined ? Number.NaN : timestampMs(response.worldTime);

const createClockHarness = (timeScale: number): {
  advanceRealTime: (deltaMs: number) => void;
  client: Client<typeof ClockService>;
  clock: IClock;
} => {
  let realNowMs = 0;
  const clock = createScaledClock({
    initial: { timeScale, worldTimeMs: SEED_WORLD_START_MS },
    realTime: { now: () => realNowMs },
  });
  const { runtime } = createTestRuntime();
  const transport = createRouterTransport(({ service }) => {
    service(ClockService, createClockService(runtime, () => clock.getSnapshot()));
  });

  return {
    advanceRealTime: (deltaMs) => {
      realNowMs += deltaMs;
    },
    client: createClient(ClockService, transport),
    clock,
  };
};

describe('ClockService.getWorldClock', () => {
  it('returns the world time and the time scale of the engine clock', async () => {
    const { client } = createClockHarness(1);

    const response = await client.getWorldClock({}, callAs(SeedUserId.ADMIN_1));

    expect(readWorldMs(response)).toBe(SEED_WORLD_START_MS);
    expect(response.timeScale).toBe(1);
  });

  it('works with an acting organization as well', async () => {
    const { client } = createClockHarness(1);

    const response = await client.getWorldClock({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1));

    expect(response.worldTime).toBeDefined();
  });

  it('moves the world time forward as the real time passes', async () => {
    const { advanceRealTime, client } = createClockHarness(1);

    advanceRealTime(90_000);
    const response = await client.getWorldClock({}, callAs(SeedUserId.ADMIN_1));

    expect(readWorldMs(response)).toBe(SEED_WORLD_START_MS + 90_000);
  });

  it('returns a time scale other than one as is and scales the elapsed time', async () => {
    const { advanceRealTime, client } = createClockHarness(60);

    advanceRealTime(1_000);
    const response = await client.getWorldClock({}, callAs(SeedUserId.ADMIN_1));

    expect(response.timeScale).toBe(60);
    expect(readWorldMs(response)).toBe(SEED_WORLD_START_MS + 60_000);
  });

  it('keeps the world time still on a paused clock', async () => {
    const { advanceRealTime, client } = createClockHarness(0);

    advanceRealTime(5_000);
    const response = await client.getWorldClock({}, callAs(SeedUserId.ADMIN_1));

    expect(response.timeScale).toBe(0);
    expect(readWorldMs(response)).toBe(SEED_WORLD_START_MS);
  });

  it('reads the clock again on every call, so a replaced clock is picked up', async () => {
    let current = createScaledClock({
      initial: { timeScale: 1, worldTimeMs: 10_000 },
      realTime: { now: () => 0 },
    });
    const { runtime } = createTestRuntime();
    const client = createClient(ClockService, createRouterTransport(({ service }) => {
      service(ClockService, createClockService(runtime, () => current.getSnapshot()));
    }));

    const before = await client.getWorldClock({}, callAs(SeedUserId.ADMIN_1));
    current = createScaledClock({
      initial: { timeScale: 1, worldTimeMs: 20_000 },
      realTime: { now: () => 0 },
    });
    const after = await client.getWorldClock({}, callAs(SeedUserId.ADMIN_1));

    expect(readWorldMs(before)).toBe(10_000);
    expect(readWorldMs(after)).toBe(20_000);
  });

  it('rejects a call without a user with session_required', async () => {
    const { client } = createClockHarness(1);

    const error = await captureError(client.getWorldClock({}, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});
