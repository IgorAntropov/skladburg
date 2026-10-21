import type {
  ConnectRouter,
  Transport,
} from '@connectrpc/connect';
import type { GetWorldClockResponse } from '@skladburg/contracts/clock/v1/clock';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createRouterTransport } from '@connectrpc/connect';
import {
  ClockService,
  GetWorldClockResponseSchema,
} from '@skladburg/contracts/clock/v1/clock';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createApiClient } from './createApiClient';

const WORLD_TIME_MS = 1_700_000_000_000;
const TIME_SCALE = 4;

const createWorldClockResponse = (): GetWorldClockResponse =>
  create(GetWorldClockResponseSchema, { timeScale: TIME_SCALE, worldTime: timestampFromMs(WORLD_TIME_MS) });

const createClockTransport = (getWorldClock: () => GetWorldClockResponse): Transport =>
  createRouterTransport((router: ConnectRouter) => {
    router.service(ClockService, { getWorldClock });
  });

describe('createApiClient', () => {
  it('returns the same client for the same service descriptor', () => {
    const client = createApiClient(createClockTransport(createWorldClockResponse));

    expect(client.service(ClockService)).toBe(client.service(ClockService));
  });

  it('returns different clients for different service descriptors', () => {
    const client = createApiClient(createClockTransport(createWorldClockResponse));

    expect(client.service(ClockService)).not.toBe(client.service(OrganizationService));
  });

  it('sends the call through the transport and returns the response of the route', async () => {
    const getWorldClock = vi.fn(createWorldClockResponse);
    const client = createApiClient(createClockTransport(getWorldClock));

    const response = await client.service(ClockService).getWorldClock({});

    expect(getWorldClock).toHaveBeenCalledTimes(1);
    expect(response.timeScale).toBe(TIME_SCALE);
    expect(Number(response.worldTime?.seconds)).toBe(WORLD_TIME_MS / 1000);
  });

  it('does not share the cache between two api clients', () => {
    const transport = createClockTransport(createWorldClockResponse);
    const firstClient = createApiClient(transport);
    const secondClient = createApiClient(transport);

    expect(firstClient.service(ClockService)).not.toBe(secondClient.service(ClockService));
  });
});
