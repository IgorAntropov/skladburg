import type { QueryClient } from '@tanstack/react-query';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  type MockInstance,
  vi,
} from 'vitest';

import type { IActingContextStore } from '../context/actingContextTypes';
import type { IErrorJournal } from '../errors/errorJournal';
import type {
  DemoPersonaListItemValue,
  IDemoControl,
} from '../transport/demo';

import { createActingContextStore } from '../context/createActingContextStore';
import { createErrorJournal } from '../errors/errorJournal';
import { DemoPersonaGroup } from '../transport/demo/demoPersonaGroup';
import { DemoPersonaKind } from '../transport/demo/demoPersonaKind';
import { createQueryClient } from './createQueryClient';
import { returnToDefaultPersonaOnDemoReset } from './returnToDefaultPersonaOnDemoReset';

const DEFAULT_ORGANIZATION_ID = 'org-default';
const OTHER_ORGANIZATION_ID = 'org-other';
const CACHED_QUERY_KEY = ['warehouses'];

const createPersona = (id: string, organizationId: string): DemoPersonaListItemValue => ({
  group: DemoPersonaGroup.FRESH,
  id,
  kind: DemoPersonaKind.CUSTOMER,
  organizationId,
  organizationName: `Organization ${organizationId}`,
  roleName: 'Administrator',
  userDisplayName: `User of ${id}`,
  userId: `user-of-${id}`,
});

const DEFAULT_PERSONA = createPersona('persona-a', DEFAULT_ORGANIZATION_ID);
const SECOND_DEFAULT_PERSONA = createPersona('persona-b', DEFAULT_ORGANIZATION_ID);
const OTHER_PERSONA = createPersona('persona-c', OTHER_ORGANIZATION_ID);
const ALL_PERSONAS = [OTHER_PERSONA, SECOND_DEFAULT_PERSONA, DEFAULT_PERSONA];

const toContext = (persona: DemoPersonaListItemValue): { organizationId: string; userId: string } => ({
  organizationId: persona.organizationId,
  userId: persona.userId,
});

interface DeferredValue<T> {
  promise: Promise<T>;
  reject: (reason: Error) => void;
  resolve: (value: T) => void;
}

const createDeferred = <T>(): DeferredValue<T> => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const settle = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

interface FakeDemoControlValue {
  control: IDemoControl;
  emitReset: (epoch: string) => void;
  getListenerCount: () => number;
  listPersonas: Mock<IDemoControl['listPersonas']>;
}

const createFakeDemoControl = (): FakeDemoControlValue => {
  const listeners = new Set<(epoch: string) => void>();
  const listPersonas = vi.fn<IDemoControl['listPersonas']>(() => Promise.resolve(ALL_PERSONAS));

  return {
    control: {
      listPersonas,
      onReset: (listener) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
      onStatus: () => () => undefined,
      reset: () => Promise.resolve(),
    },
    emitReset: (epoch) => {
      for (const listener of [...listeners]) {
        listener(epoch);
      }
    },
    getListenerCount: () => listeners.size,
    listPersonas,
  };
};

describe('returnToDefaultPersonaOnDemoReset', () => {
  let actingContext: IActingContextStore;
  let errorJournal: IErrorJournal;
  let queryClient: QueryClient;
  let fake: FakeDemoControlValue;
  let cancelQueries: MockInstance<QueryClient['cancelQueries']>;
  let clear: MockInstance<QueryClient['clear']>;
  let consoleError: MockInstance<Console['error']>;
  let stops: (() => void)[];

  const startWith = (demoControl: IDemoControl | undefined): (() => void) => {
    const stop = returnToDefaultPersonaOnDemoReset({
      actingContext,
      defaultOrganizationId: DEFAULT_ORGANIZATION_ID,
      demoControl,
      errorJournal,
      queryClient,
    });
    stops.push(stop);

    return stop;
  };

  const start = (): (() => void) => startWith(fake.control);

  beforeEach(() => {
    actingContext = createActingContextStore(toContext(OTHER_PERSONA));
    errorJournal = createErrorJournal();
    errorJournal.record({
      code: ErrorCode.INTERNAL,
      method: 'unknown',
      occurredAt: 1,
      params: { case: undefined },
      traceId: undefined,
    });
    queryClient = createQueryClient({ networkMode: 'always' });
    queryClient.setQueryData(CACHED_QUERY_KEY, ['cached']);
    fake = createFakeDemoControl();
    cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
    clear = vi.spyOn(queryClient, 'clear');
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stops = [];
  });

  afterEach(() => {
    stops.forEach((stop) => {
      stop();
    });
    queryClient.clear();
    vi.restoreAllMocks();
  });

  describe('when the demo is reset', () => {
    it('returns to the first persona of the default organization and clears the cache', async () => {
      start();

      fake.emitReset('epoch-2');
      await settle();

      expect(actingContext.get()).toEqual(toContext(DEFAULT_PERSONA));
      expect(clear).toHaveBeenCalledOnce();
      expect(queryClient.getQueryCache().findAll()).toHaveLength(0);
      expect(errorJournal.list()).toEqual([]);
    });

    it('does nothing when the tab already works as the default persona', async () => {
      actingContext.set(toContext(DEFAULT_PERSONA));
      start();

      fake.emitReset('epoch-2');
      await settle();

      expect(fake.listPersonas).toHaveBeenCalledOnce();
      expect(cancelQueries).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(actingContext.get()).toEqual(toContext(DEFAULT_PERSONA));
      expect(queryClient.getQueryData(CACHED_QUERY_KEY)).toEqual(['cached']);
      expect(errorJournal.list()).toHaveLength(1);
    });

    it('keeps the current persona when the default organization has none', async () => {
      fake.listPersonas.mockResolvedValue([OTHER_PERSONA]);
      start();

      fake.emitReset('epoch-2');
      await settle();

      expect(actingContext.get()).toEqual(toContext(OTHER_PERSONA));
      expect(clear).not.toHaveBeenCalled();
    });

    it('switches once when two resets come in the same moment', async () => {
      start();

      fake.emitReset('epoch-2');
      fake.emitReset('epoch-3');
      await settle();

      expect(fake.listPersonas).toHaveBeenCalledOnce();
      expect(cancelQueries).toHaveBeenCalledOnce();
      expect(clear).toHaveBeenCalledOnce();
      expect(actingContext.get()).toEqual(toContext(DEFAULT_PERSONA));
    });

    it('drops the answer of an outdated reset and uses the personas of the latest one', async () => {
      const firstAnswer = createDeferred<readonly DemoPersonaListItemValue[]>();
      const secondAnswer = createDeferred<readonly DemoPersonaListItemValue[]>();
      fake.listPersonas
        .mockReturnValueOnce(firstAnswer.promise)
        .mockReturnValueOnce(secondAnswer.promise);
      start();

      fake.emitReset('epoch-2');
      await settle();
      fake.emitReset('epoch-3');
      firstAnswer.resolve([DEFAULT_PERSONA, OTHER_PERSONA]);
      await settle();

      expect(actingContext.get()).toEqual(toContext(OTHER_PERSONA));
      expect(clear).not.toHaveBeenCalled();

      secondAnswer.resolve([SECOND_DEFAULT_PERSONA, OTHER_PERSONA]);
      await settle();

      expect(actingContext.get()).toEqual(toContext(SECOND_DEFAULT_PERSONA));
      expect(clear).toHaveBeenCalledOnce();
    });

    it('waits for the running switch before it handles the next reset', async () => {
      const cancelling = createDeferred<undefined>();
      cancelQueries.mockReturnValueOnce(cancelling.promise);
      start();

      fake.emitReset('epoch-2');
      await settle();

      expect(actingContext.get()).toEqual(toContext(OTHER_PERSONA));

      fake.emitReset('epoch-3');
      await settle();

      expect(fake.listPersonas).toHaveBeenCalledOnce();

      cancelling.resolve(undefined);
      await settle();

      expect(fake.listPersonas).toHaveBeenCalledTimes(2);
      expect(cancelQueries).toHaveBeenCalledOnce();
      expect(clear).toHaveBeenCalledOnce();
      expect(actingContext.get()).toEqual(toContext(DEFAULT_PERSONA));
    });
  });

  describe('when the personas cannot be loaded', () => {
    it('logs the error, keeps the persona and handles the next reset', async () => {
      const error = new Error('engine is unavailable');
      fake.listPersonas.mockRejectedValueOnce(error);
      start();

      fake.emitReset('epoch-2');
      await settle();

      expect(consoleError).toHaveBeenCalledExactlyOnceWith(
        '> returnToDefaultPersonaOnDemoReset -> returnToDefaultPersona:',
        { epoch: 'epoch-2', error },
      );
      expect(actingContext.get()).toEqual(toContext(OTHER_PERSONA));
      expect(clear).not.toHaveBeenCalled();

      fake.emitReset('epoch-3');
      await settle();

      expect(actingContext.get()).toEqual(toContext(DEFAULT_PERSONA));
    });

    it('logs the error and keeps the persona when cancelling the queries fails', async () => {
      const error = new Error('cancel failed');
      cancelQueries.mockRejectedValueOnce(error);
      start();

      fake.emitReset('epoch-2');
      await settle();

      expect(consoleError).toHaveBeenCalledOnce();
      expect(actingContext.get()).toEqual(toContext(OTHER_PERSONA));
      expect(clear).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('ignores the answer that arrives after the stop', async () => {
      const answer = createDeferred<readonly DemoPersonaListItemValue[]>();
      fake.listPersonas.mockReturnValueOnce(answer.promise);
      const stop = start();

      fake.emitReset('epoch-2');
      await settle();
      stop();
      answer.resolve(ALL_PERSONAS);
      await settle();

      expect(cancelQueries).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(actingContext.get()).toEqual(toContext(OTHER_PERSONA));
    });

    it('stops listening for resets and can be called twice', async () => {
      const stop = start();

      expect(fake.getListenerCount()).toBe(1);

      stop();
      stop();
      fake.emitReset('epoch-2');
      await settle();

      expect(fake.getListenerCount()).toBe(0);
      expect(fake.listPersonas).not.toHaveBeenCalled();
      expect(actingContext.get()).toEqual(toContext(OTHER_PERSONA));
    });
  });

  describe('without the demo control', () => {
    it('does nothing and returns a stop function that is safe to call', () => {
      const stop = startWith(undefined);

      expect(() => {
        stop();
      }).not.toThrow();
      expect(fake.getListenerCount()).toBe(0);
      expect(actingContext.get()).toEqual(toContext(OTHER_PERSONA));
    });
  });
});
