import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  ReplicaQueueInputValue,
  ShownReplicaValue,
} from './planReplicas';

import {
  getNextWakeAtMs,
  INITIAL_REPLICA_QUEUE,
  planReplicas,
} from './planReplicas';

export interface ReplicaQueueValue {
  current: ShownReplicaValue | undefined;
  dispatch: (input: ReplicaQueueInputValue) => void;
}

const MIN_WAKE_DELAY_MS = 1;

export const useReplicaQueue = (epochCount: number): ReplicaQueueValue => {
  const [state, setState] = useState(INITIAL_REPLICA_QUEUE);
  const lastEpochCountRef = useRef(epochCount);

  const dispatch = useCallback((input: ReplicaQueueInputValue): void => {
    const nowMs = Date.now();

    setState(previous => planReplicas(previous, input, nowMs));
  }, []);

  const wakeAtMs = getNextWakeAtMs(state);

  useEffect(() => {
    if (lastEpochCountRef.current === epochCount) {
      return;
    }

    lastEpochCountRef.current = epochCount;
    dispatch({ kind: 'reset' });
  }, [dispatch, epochCount]);

  useEffect(() => {
    if (wakeAtMs === undefined) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      dispatch({ kind: 'tick' });
    }, Math.max(MIN_WAKE_DELAY_MS, wakeAtMs - Date.now()));

    return (): void => {
      window.clearTimeout(timer);
    };
  }, [dispatch, state, wakeAtMs]);

  return { current: state.current, dispatch };
};
