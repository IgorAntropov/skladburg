import {
  Code,
  ConnectError,
} from '@connectrpc/connect';

export type PlacesRecoveryValue = 'reload' | 'retry';

export const getPlacesRecovery = (error: unknown): PlacesRecoveryValue => (
  error instanceof ConnectError && error.code === Code.Unimplemented ? 'reload' : 'retry'
);
