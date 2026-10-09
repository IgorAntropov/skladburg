import type { ConnectRouter } from '@connectrpc/connect';
import type { GetWorldClockResponse } from '@skladburg/contracts/clock/v1/clock';

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

export const WORLD_MINUTE_START_MS = Date.UTC(2026, 9, 9, 12, 7, 0);
export const WORLD_START_MS = WORLD_MINUTE_START_MS + 20_000;

export interface WorldClockRoutesOptionsValue {
  failure?: ConnectError | undefined;
  gate?: Promise<void> | undefined;
  timeScale?: number | undefined;
  worldStartMs?: number | undefined;
}

export interface WorldClockRoutesValue {
  getCallCount: () => number;
  routes: (router: ConnectRouter) => void;
}

export const createUnavailableFailure = (): ConnectError => new ConnectError('clock is down', Code.Unavailable);

export const createWorldClockRoutes = ({
  failure,
  gate,
  timeScale = 1,
  worldStartMs = WORLD_START_MS,
}: WorldClockRoutesOptionsValue = {}): WorldClockRoutesValue => {
  let callCount = 0;

  const routes = (router: ConnectRouter): void => {
    router.service(ClockService, {
      getWorldClock: async (): Promise<GetWorldClockResponse> => {
        callCount += 1;
        await gate;

        if (failure !== undefined) {
          throw failure;
        }

        return create(GetWorldClockResponseSchema, {
          timeScale,
          worldTime: timestampFromMs(Math.round(worldStartMs + performance.now() * timeScale)),
        });
      },
    });
  };

  return { getCallCount: () => callCount, routes };
};
