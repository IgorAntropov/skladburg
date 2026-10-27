import type { ReplicaValue } from './replicaTypes';

import {
  getReplicaDurationMs,
  REPLICA_BURST_LIMIT,
  REPLICA_BURST_WINDOW_MS,
  REPLICA_GAP_MS,
  REPLICA_HOLD_GRACE_MS,
} from './replicaTiming';

export type ReplicaQueueInputValue
  = | { isQuiet: boolean; kind: 'enqueue'; replicas: readonly ReplicaValue[] }
    | { isQuiet: boolean; kind: 'quiet' }
    | { isSuspended: boolean; kind: 'suspend' }
    | { kind: 'dismiss' }
    | { kind: 'hold' }
    | { kind: 'release' }
    | { kind: 'reset' }
    | { kind: 'tick' };

export interface ReplicaQueueStateValue {
  arrivalsMs: readonly number[];
  current: ShownReplicaValue | undefined;
  isSuspended: boolean;
  nextAllowedAtMs: number;
  pending: readonly ReplicaValue[];
}

export interface ShownReplicaValue {
  dueAtMs: number;
  isHeld: boolean;
  replica: ReplicaValue;
}

export const INITIAL_REPLICA_QUEUE: ReplicaQueueStateValue = {
  arrivalsMs: [],
  current: undefined,
  isSuspended: false,
  nextAllowedAtMs: 0,
  pending: [],
};

const show = (replica: ReplicaValue, nowMs: number): ShownReplicaValue => ({
  dueAtMs: nowMs + getReplicaDurationMs(replica.importance),
  isHeld: false,
  replica,
});

const settle = (state: ReplicaQueueStateValue, nowMs: number): ReplicaQueueStateValue => {
  const [next, ...rest] = state.pending;

  if (state.current !== undefined || state.isSuspended || next === undefined) {
    return state;
  }

  const isAllowed = next.importance === 'critical' || nowMs >= state.nextAllowedAtMs;

  return isAllowed ? { ...state, current: show(next, nowMs), pending: rest } : state;
};

const close = (state: ReplicaQueueStateValue, nowMs: number): ReplicaQueueStateValue => {
  return settle({ ...state, current: undefined, nextAllowedAtMs: nowMs + REPLICA_GAP_MS }, nowMs);
};

const placeCritical = (state: ReplicaQueueStateValue, replica: ReplicaValue, nowMs: number): ReplicaQueueStateValue => {
  const isCriticalShown = state.current?.replica.importance === 'critical';

  if (isCriticalShown || state.isSuspended) {
    const lastCriticalIndex = state.pending.findLastIndex(candidate => candidate.importance === 'critical');
    const pending = [...state.pending];

    pending.splice(lastCriticalIndex + 1, 0, replica);

    return { ...state, pending };
  }

  return { ...state, current: show(replica, nowMs) };
};

const foldIntoMore = (pending: readonly ReplicaValue[], nowMs: number): ReplicaValue[] => {
  const moreIndex = pending.findLastIndex(replica => replica.body.kind === 'more');
  const more = pending[moreIndex];

  if (more?.body.kind === 'more') {
    return pending.with(moreIndex, { ...more, body: { count: more.body.count + 1, kind: 'more' } });
  }

  return [
    ...pending,
    {
      body: { count: 1, kind: 'more' },
      hasCenterLink: true,
      id: `more:${String(nowMs)}`,
      importance: 'normal',
      links: [],
    },
  ];
};

const enqueueOrdinary = (
  state: ReplicaQueueStateValue,
  replicas: readonly ReplicaValue[],
  nowMs: number,
): ReplicaQueueStateValue => {
  let arrivalsMs = state.arrivalsMs.filter(arrivedAtMs => arrivedAtMs > nowMs - REPLICA_BURST_WINDOW_MS);
  let pending: readonly ReplicaValue[] = state.pending;

  for (const replica of replicas) {
    const isInCenter = replica.body.kind === 'notification';

    if (isInCenter && arrivalsMs.length >= REPLICA_BURST_LIMIT) {
      pending = foldIntoMore(pending, nowMs);
    }
    else {
      arrivalsMs = [...arrivalsMs, nowMs];
      pending = [...pending, replica];
    }
  }

  return { ...state, arrivalsMs, pending };
};

const enqueue = (
  state: ReplicaQueueStateValue,
  replicas: readonly ReplicaValue[],
  isQuiet: boolean,
  nowMs: number,
): ReplicaQueueStateValue => {
  const accepted = replicas.filter(replica => !(isQuiet && replica.importance === 'normal'));
  const critical = accepted.filter(replica => replica.importance === 'critical');
  const ordinary = accepted.filter(replica => replica.importance !== 'critical');

  const withCritical = critical.reduce((current, replica) => placeCritical(current, replica, nowMs), state);

  return settle(enqueueOrdinary(withCritical, ordinary, nowMs), nowMs);
};

const holdCurrent = (state: ReplicaQueueStateValue, isHeld: boolean, nowMs: number): ReplicaQueueStateValue => {
  const { current } = state;

  if (current === undefined) {
    return state;
  }

  const dueAtMs = isHeld ? current.dueAtMs : Math.max(current.dueAtMs, nowMs + REPLICA_HOLD_GRACE_MS);

  return { ...state, current: { ...current, dueAtMs, isHeld } };
};

const tick = (state: ReplicaQueueStateValue, nowMs: number): ReplicaQueueStateValue => {
  const { current } = state;

  if (current === undefined) {
    return settle({ ...state }, nowMs);
  }

  return !current.isHeld && nowMs >= current.dueAtMs ? close(state, nowMs) : { ...state };
};

const suspend = (state: ReplicaQueueStateValue, isSuspended: boolean, nowMs: number): ReplicaQueueStateValue => {
  if (isSuspended) {
    const wasShown = state.current !== undefined;

    return {
      ...state,
      current: undefined,
      isSuspended,
      nextAllowedAtMs: wasShown ? nowMs + REPLICA_GAP_MS : state.nextAllowedAtMs,
    };
  }

  return settle({ ...state, isSuspended }, nowMs);
};

export const planReplicas = (
  state: ReplicaQueueStateValue,
  input: ReplicaQueueInputValue,
  nowMs: number,
): ReplicaQueueStateValue => {
  switch (input.kind) {
    case 'dismiss':
      return state.current === undefined ? state : close(state, nowMs);
    case 'enqueue':
      return enqueue(state, input.replicas, input.isQuiet, nowMs);
    case 'hold':
      return holdCurrent(state, true, nowMs);
    case 'quiet':
      return input.isQuiet
        ? { ...state, pending: state.pending.filter(replica => replica.importance !== 'normal') }
        : state;
    case 'release':
      return holdCurrent(state, false, nowMs);
    case 'reset':
      return { ...INITIAL_REPLICA_QUEUE, isSuspended: state.isSuspended };
    case 'suspend':
      return suspend(state, input.isSuspended, nowMs);
    case 'tick':
      return tick(state, nowMs);
  }
};

export const getNextWakeAtMs = (state: ReplicaQueueStateValue): number | undefined => {
  if (state.current !== undefined) {
    return state.current.isHeld ? undefined : state.current.dueAtMs;
  }

  return state.pending.length > 0 && !state.isSuspended ? state.nextAllowedAtMs : undefined;
};
