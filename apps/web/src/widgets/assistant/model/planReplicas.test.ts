import { create } from '@bufbuild/protobuf';
import { NotificationSchema } from '@skladburg/contracts/notification/v1/notification';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  ReplicaQueueInputValue,
  ReplicaQueueStateValue,
} from './planReplicas';
import type {
  ReplicaImportanceValue,
  ReplicaValue,
} from './replicaTypes';

import {
  getNextWakeAtMs,
  INITIAL_REPLICA_QUEUE,
  planReplicas,
} from './planReplicas';
import {
  CRITICAL_REPLICA_DURATION_MS,
  REPLICA_BURST_WINDOW_MS,
  REPLICA_DURATION_MS,
  REPLICA_GAP_MS,
  REPLICA_HOLD_GRACE_MS,
} from './replicaTiming';

const createReplica = (id: string, importance: ReplicaImportanceValue = 'important'): ReplicaValue => ({
  body: { kind: 'notification', notification: create(NotificationSchema, { id }) },
  centerAction: undefined,
  id,
  importance,
  links: [],
});

const enqueue = (replicas: readonly ReplicaValue[], isQuiet = false): ReplicaQueueInputValue => ({
  isQuiet,
  kind: 'enqueue',
  replicas,
});

const run = (
  start: ReplicaQueueStateValue,
  steps: readonly (readonly [ReplicaQueueInputValue, number])[],
): ReplicaQueueStateValue => steps.reduce((state, [input, nowMs]) => planReplicas(state, input, nowMs), start);

const shownId = (state: ReplicaQueueStateValue): string | undefined => state.current?.replica.id;

const pendingIds = (state: ReplicaQueueStateValue): string[] => state.pending.map(replica => replica.id);

describe('planReplicas', () => {
  describe('showing one replica at a time', () => {
    it('shows the first replica at once for the ordinary duration', () => {
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a')]), 1000);

      expect(shownId(state)).toBe('a');
      expect(state.current?.dueAtMs).toBe(1000 + REPLICA_DURATION_MS);
    });

    it('keeps the second replica waiting while the first is shown', () => {
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a'), createReplica('b')]), 0);

      expect(shownId(state)).toBe('a');
      expect(pendingIds(state)).toEqual(['b']);
    });

    it('waits a pause of at least four seconds after a replica leaves', () => {
      const start = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a'), createReplica('b')]), 0);
      const closedAtMs = REPLICA_DURATION_MS;
      const closed = planReplicas(start, { kind: 'tick' }, closedAtMs);

      expect(closed.current).toBeUndefined();
      expect(getNextWakeAtMs(closed)).toBe(closedAtMs + REPLICA_GAP_MS);

      const tooEarly = planReplicas(closed, { kind: 'tick' }, closedAtMs + REPLICA_GAP_MS - 1);

      expect(tooEarly.current).toBeUndefined();

      const onTime = planReplicas(closed, { kind: 'tick' }, closedAtMs + REPLICA_GAP_MS);

      expect(shownId(onTime)).toBe('b');
    });

    it('waits the same pause after the user hides a replica', () => {
      const start = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a'), createReplica('b')]), 0);
      const hidden = planReplicas(start, { kind: 'dismiss' }, 2000);

      expect(hidden.current).toBeUndefined();
      expect(getNextWakeAtMs(hidden)).toBe(2000 + REPLICA_GAP_MS);
    });

    it('does not show a new replica right after a pause when nothing is waiting', () => {
      const start = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a')]), 0);
      const closed = planReplicas(start, { kind: 'tick' }, REPLICA_DURATION_MS);
      const arrived = planReplicas(closed, enqueue([createReplica('b')]), REPLICA_DURATION_MS + 1000);

      expect(arrived.current).toBeUndefined();
      expect(getNextWakeAtMs(arrived)).toBe(REPLICA_DURATION_MS + REPLICA_GAP_MS);
    });
  });

  describe('pausing', () => {
    it('does not let a held replica go away', () => {
      const shown = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a')]), 0);
      const held = planReplicas(shown, { kind: 'hold' }, 1000);
      const later = planReplicas(held, { kind: 'tick' }, 60000);

      expect(shownId(later)).toBe('a');
      expect(getNextWakeAtMs(held)).toBeUndefined();
    });

    it('leaves at least four seconds after the pointer or focus leaves', () => {
      const shown = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a')]), 0);
      const held = planReplicas(shown, { kind: 'hold' }, 7000);
      const released = planReplicas(held, { kind: 'release' }, 9000);

      expect(released.current?.dueAtMs).toBe(9000 + REPLICA_HOLD_GRACE_MS);
    });

    it('keeps the original time when more than four seconds were left on release', () => {
      const shown = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a')]), 0);
      const held = planReplicas(shown, { kind: 'hold' }, 100);
      const released = planReplicas(held, { kind: 'release' }, 200);

      expect(released.current?.dueAtMs).toBe(REPLICA_DURATION_MS);
    });
  });

  describe('a burst', () => {
    it('folds everything beyond three replicas in ten seconds into one "more"', () => {
      const replicas = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => createReplica(id));
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue(replicas), 0);

      expect(shownId(state)).toBe('a');
      expect(pendingIds(state)).toEqual(['b', 'c', expect.stringMatching(/^more:/)]);

      const more = state.pending.at(-1);

      expect(more?.body).toEqual({ count: 3, kind: 'more' });
      expect(more?.centerAction).toBe('notifications');
    });

    it('counts the arrivals of separate batches inside the window', () => {
      const state = run(INITIAL_REPLICA_QUEUE, [
        [enqueue([createReplica('a'), createReplica('b')]), 0],
        [enqueue([createReplica('c')]), 3000],
        [enqueue([createReplica('d')]), 6000],
        [enqueue([createReplica('e')]), 9000],
      ]);

      expect(pendingIds(state)).toEqual(['b', 'c', expect.stringMatching(/^more:/)]);
      expect(state.pending.at(-1)?.body).toEqual({ count: 2, kind: 'more' });
    });

    it('forgets arrivals older than the window', () => {
      const state = run(INITIAL_REPLICA_QUEUE, [
        [enqueue([createReplica('a'), createReplica('b'), createReplica('c')]), 0],
        [enqueue([createReplica('d')]), REPLICA_BURST_WINDOW_MS + 1],
      ]);

      expect(pendingIds(state)).toEqual(['b', 'c', 'd']);
    });

    it('lets an important replica ride in the burst like any other', () => {
      const replicas = [
        createReplica('a'),
        createReplica('b'),
        createReplica('c'),
        createReplica('d', 'important'),
      ];
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue(replicas), 0);

      expect(state.pending.at(-1)?.body).toEqual({ count: 1, kind: 'more' });
    });

    it('never folds an error explanation or the digest, which the center does not keep', () => {
      const error: ReplicaValue = {
        ...createReplica('error'),
        body: { hintKey: 'assistant.error.hint.notFound', kind: 'error', reason: 'Не найдено' },
      };
      const digest: ReplicaValue = {
        ...createReplica('digest', 'normal'),
        body: { kind: 'digest', lines: [] },
      };
      const replicas = [
        createReplica('a'),
        createReplica('b'),
        createReplica('c'),
        createReplica('d'),
        error,
        createReplica('e'),
        digest,
      ];
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue(replicas), 0);

      expect(pendingIds(state)).toEqual(['b', 'c', expect.stringMatching(/^more:/), 'error', 'digest']);
      expect(state.pending.at(2)?.body).toEqual({ count: 2, kind: 'more' });
    });
  });

  describe('critical replicas', () => {
    it('shows a critical replica at once over the shown one and ignores the pause', () => {
      const shown = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a')]), 0);
      const closed = planReplicas(shown, { kind: 'dismiss' }, 1000);
      const critical = planReplicas(closed, enqueue([createReplica('c', 'critical')]), 1500);

      expect(shownId(critical)).toBe('c');
      expect(critical.current?.dueAtMs).toBe(1500 + CRITICAL_REPLICA_DURATION_MS);

      const over = planReplicas(shown, enqueue([createReplica('c', 'critical')]), 2000);

      expect(shownId(over)).toBe('c');
    });

    it('does not count critical replicas in the burst', () => {
      const replicas = [
        createReplica('a'),
        createReplica('b'),
        createReplica('c'),
        createReplica('d'),
        createReplica('x', 'critical'),
      ];
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue(replicas), 0);

      expect(shownId(state)).toBe('x');
      expect(pendingIds(state).slice(0, 3)).toEqual(['a', 'b', 'c']);
      expect(state.pending.at(-1)?.body).toEqual({ count: 1, kind: 'more' });
    });

    it('queues a second critical replica ahead of the ordinary ones and shows it without a pause', () => {
      const state = run(INITIAL_REPLICA_QUEUE, [
        [enqueue([createReplica('a'), createReplica('b')]), 0],
        [enqueue([createReplica('c1', 'critical')]), 100],
        [enqueue([createReplica('c2', 'critical')]), 200],
      ]);

      expect(shownId(state)).toBe('c1');
      expect(pendingIds(state)).toEqual(['c2', 'b']);

      const next = planReplicas(state, { kind: 'dismiss' }, 300);

      expect(shownId(next)).toBe('c2');
    });

    it('keeps critical replicas even in the quiet mode', () => {
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('c', 'critical')], true), 0);

      expect(shownId(state)).toBe('c');
    });
  });

  describe('the quiet mode', () => {
    it('drops ordinary replicas but keeps important and critical ones', () => {
      const replicas = [
        createReplica('n', 'normal'),
        createReplica('i', 'important'),
        createReplica('c', 'critical'),
      ];
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue(replicas, true), 0);
      const everything = [shownId(state), ...pendingIds(state)];

      expect(everything).toContain('i');
      expect(everything).toContain('c');
      expect(everything).not.toContain('n');
    });

    it('shows an ordinary replica when the quiet mode is off', () => {
      const state = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('n', 'normal')], false), 0);

      expect(shownId(state)).toBe('n');
    });

    it('drops waiting ordinary replicas when the quiet mode turns on', () => {
      const shown = planReplicas(
        INITIAL_REPLICA_QUEUE,
        enqueue([createReplica('a'), createReplica('n', 'normal'), createReplica('i', 'important')]),
        0,
      );
      const quiet = planReplicas(shown, { isQuiet: true, kind: 'quiet' }, 100);

      expect(pendingIds(quiet)).toEqual(['i']);
    });
  });

  describe('the center panel', () => {
    it('hides the shown replica and shows nothing while the panel is open', () => {
      const shown = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a')]), 0);
      const suspended = planReplicas(shown, { isSuspended: true, kind: 'suspend' }, 1000);
      const arrived = planReplicas(suspended, enqueue([createReplica('b'), createReplica('c', 'critical')]), 2000);

      expect(suspended.current).toBeUndefined();
      expect(arrived.current).toBeUndefined();
      expect(pendingIds(arrived)).toEqual(['c', 'b']);
      expect(getNextWakeAtMs(arrived)).toBeUndefined();
    });

    it('shows the waiting replica after the panel closes', () => {
      const suspended = planReplicas(INITIAL_REPLICA_QUEUE, { isSuspended: true, kind: 'suspend' }, 0);
      const arrived = planReplicas(suspended, enqueue([createReplica('b')]), 1000);
      const resumed = planReplicas(arrived, { isSuspended: false, kind: 'suspend' }, 5000);

      expect(shownId(resumed)).toBe('b');
    });
  });

  describe('reset', () => {
    it('clears the shown replica, the queue and the burst memory', () => {
      const replicas = ['a', 'b', 'c', 'd'].map(id => createReplica(id));
      const busy = planReplicas(INITIAL_REPLICA_QUEUE, enqueue(replicas), 0);
      const reset = planReplicas(busy, { kind: 'reset' }, 100);

      expect(reset).toEqual(INITIAL_REPLICA_QUEUE);
      expect(shownId(planReplicas(reset, enqueue([createReplica('e')]), 200))).toBe('e');
    });

    it('keeps the suspension of an open center panel', () => {
      const suspended = planReplicas(INITIAL_REPLICA_QUEUE, { isSuspended: true, kind: 'suspend' }, 0);

      expect(planReplicas(suspended, { kind: 'reset' }, 100).isSuspended).toBe(true);
    });
  });

  describe('getNextWakeAtMs', () => {
    it('wakes at the due time of the shown replica', () => {
      const shown = planReplicas(INITIAL_REPLICA_QUEUE, enqueue([createReplica('a')]), 500);

      expect(getNextWakeAtMs(shown)).toBe(500 + REPLICA_DURATION_MS);
    });

    it('does not wake an empty queue', () => {
      expect(getNextWakeAtMs(INITIAL_REPLICA_QUEUE)).toBeUndefined();
    });
  });
});
