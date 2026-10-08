import { create } from '@bufbuild/protobuf';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import {
  DEMO_USER_HEADER,
  type EngineSubscriptionHandlersValue,
  type IEngineConnection,
} from '@skladburg/demo-engine/client';
import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ApiErrorValue } from '../../errors/apiErrorTypes';

import { createTestEvent } from '../../realtime/testing/createFakeRealtimeSource';
import { createDemoRealtimeSource } from './createDemoRealtimeSource';

const CHANNEL = `org:${SeedOrganizationId.BUYER_1}`;

interface RecordedSubscriptionValue {
  channel: string;
  handlers: EngineSubscriptionHandlersValue;
  headers: Headers;
}

const createRecordingConnection = (unsubscribe: () => void = () => undefined): {
  connection: IEngineConnection;
  recorded: RecordedSubscriptionValue[];
} => {
  const recorded: RecordedSubscriptionValue[] = [];
  const connection: IEngineConnection = {
    close: vi.fn(),
    control: {
      listPersonas: () => Promise.resolve([]),
      onReset: () => () => undefined,
      reset: () => Promise.resolve(),
    },
    fetch: () => Promise.reject(new Error('The fetch is not used by the realtime source')),
    onStatus: () => () => undefined,
    subscribe: (channel, headers, handlers) => {
      recorded.push({ channel, handlers, headers });

      return unsubscribe;
    },
  };

  return { connection, recorded };
};

const createHandlers = (): {
  denials: ApiErrorValue[];
  handlers: Parameters<ReturnType<typeof createDemoRealtimeSource>['subscribe']>[2];
  positions: { epoch: string; seq: bigint }[];
} => {
  const denials: ApiErrorValue[] = [];
  const positions: { epoch: string; seq: bigint }[] = [];

  return {
    denials,
    handlers: {
      onDenied: (error) => {
        denials.push(error);
      },
      onEvents: vi.fn(),
      onSubscribed: (position) => {
        positions.push(position);
      },
    },
    positions,
  };
};

describe('createDemoRealtimeSource', () => {
  it('builds the headers from the acting context', () => {
    const { connection, recorded } = createRecordingConnection();

    createDemoRealtimeSource(connection).subscribe(
      CHANNEL,
      { organizationId: SeedOrganizationId.BUYER_1, userId: SeedUserId.ADMIN_1 },
      createHandlers().handlers,
    );

    expect(recorded.at(0)?.channel).toBe(CHANNEL);
    expect(recorded.at(0)?.headers.get(ACTING_ORGANIZATION_HEADER)).toBe(SeedOrganizationId.BUYER_1);
    expect(recorded.at(0)?.headers.get(DEMO_USER_HEADER)).toBe(SeedUserId.ADMIN_1);
  });

  it('leaves out the headers whose value is missing or empty', () => {
    const { connection, recorded } = createRecordingConnection();
    const source = createDemoRealtimeSource(connection);

    source.subscribe(CHANNEL, { organizationId: undefined, userId: '' }, createHandlers().handlers);

    expect(recorded.at(0)?.headers.has(ACTING_ORGANIZATION_HEADER)).toBe(false);
    expect(recorded.at(0)?.headers.has(DEMO_USER_HEADER)).toBe(false);
  });

  it('returns the unsubscribe function of the connection', () => {
    const unsubscribe = vi.fn();
    const { connection } = createRecordingConnection(unsubscribe);

    const stop = createDemoRealtimeSource(connection).subscribe(
      CHANNEL,
      { organizationId: undefined, userId: undefined },
      createHandlers().handlers,
    );
    stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('passes events and positions through and turns the refusal into an api error', () => {
    const { connection, recorded } = createRecordingConnection();
    const { denials, handlers, positions } = createHandlers();
    createDemoRealtimeSource(connection).subscribe(CHANNEL, { organizationId: undefined, userId: undefined }, handlers);
    const [subscription] = recorded;
    const events = [createTestEvent(CHANNEL, 1)];

    subscription?.handlers.onSubscribed({ epoch: 'epoch-1', seq: 5n });
    subscription?.handlers.onEvents(events);
    subscription?.handlers.onDenied(create(ErrorDetailSchema, { code: ErrorCode.MEMBERSHIP_REQUIRED, traceId: 'trace-1' }));

    expect(positions).toEqual([{ epoch: 'epoch-1', seq: 5n }]);
    expect(handlers.onEvents).toHaveBeenCalledWith(events);
    expect(denials).toEqual([
      expect.objectContaining({ code: ErrorCode.MEMBERSHIP_REQUIRED, isRetryable: false, traceId: 'trace-1' }),
    ]);
  });

  describe('against the demo engine', () => {
    const subscribeAgainstEngine = async (
      channel: string,
      context: { organizationId: string | undefined; userId: string | undefined },
    ): Promise<{ denials: ApiErrorValue[]; positions: { epoch: string; seq: bigint }[] }> => {
      const inProcess = createInProcessEngineConnection();
      const { denials, handlers, positions } = createHandlers();
      const stop = createDemoRealtimeSource(inProcess.connection).subscribe(channel, context, handlers);

      try {
        await vi.waitFor(() => {
          expect(denials.length + positions.length).toBeGreaterThan(0);
        });
      }
      finally {
        stop();
        inProcess.connection.close();
        await inProcess.close();
      }

      return { denials, positions };
    };

    it('reports the position of the channel to a member of the organization', async () => {
      const { denials, positions } = await subscribeAgainstEngine(CHANNEL, {
        organizationId: SeedOrganizationId.BUYER_1,
        userId: SeedUserId.ADMIN_1,
      });

      expect(denials).toEqual([]);
      expect(positions).toHaveLength(1);
      expect(positions.at(0)?.seq).toBe(0n);
    });

    it('turns the refusal for a missing user into session_required', async () => {
      const { denials, positions } = await subscribeAgainstEngine(CHANNEL, {
        organizationId: SeedOrganizationId.BUYER_1,
        userId: undefined,
      });

      expect(positions).toEqual([]);
      expect(denials).toEqual([
        expect.objectContaining({ code: ErrorCode.SESSION_REQUIRED, isRetryable: false }),
      ]);
    });

    it('turns the refusal for a foreign organization into membership_required', async () => {
      const { denials } = await subscribeAgainstEngine(`org:${SeedOrganizationId.SELLER_1}`, {
        organizationId: SeedOrganizationId.BUYER_1,
        userId: SeedUserId.ADMIN_1,
      });

      expect(denials).toEqual([
        expect.objectContaining({ code: ErrorCode.MEMBERSHIP_REQUIRED, isRetryable: false }),
      ]);
    });
  });
});
