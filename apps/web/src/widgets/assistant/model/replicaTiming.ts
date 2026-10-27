import type { ReplicaImportanceValue } from './replicaTypes';

export const REPLICA_DURATION_MS = 8000;

export const CRITICAL_REPLICA_DURATION_MS = 16000;

export const REPLICA_GAP_MS = 4000;

export const REPLICA_HOLD_GRACE_MS = 4000;

export const REPLICA_BURST_LIMIT = 3;

export const REPLICA_BURST_WINDOW_MS = 10000;

export const getReplicaDurationMs = (importance: ReplicaImportanceValue): number => {
  return importance === 'critical' ? CRITICAL_REPLICA_DURATION_MS : REPLICA_DURATION_MS;
};
