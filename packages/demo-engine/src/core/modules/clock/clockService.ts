import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ClockService,
  GetWorldClockResponseSchema,
} from '@skladburg/contracts/clock/v1/clock';

import type { ClockSnapshotValue } from '../../ports/index';
import type { IModuleRuntime } from '../moduleRuntime';

export const createClockService = (
  runtime: IModuleRuntime,
  readClockSnapshot: () => ClockSnapshotValue,
): ServiceImpl<typeof ClockService> => {
  const { guard, read } = runtime;

  return {
    getWorldClock: (request, context) => {
      guard.guardCall(read, ClockService.method.getWorldClock, request, context.requestHeader);
      const snapshot = readClockSnapshot();

      return create(GetWorldClockResponseSchema, {
        timeScale: snapshot.timeScale,
        worldTime: timestampFromMs(snapshot.worldTimeMs),
      });
    },
  };
};
