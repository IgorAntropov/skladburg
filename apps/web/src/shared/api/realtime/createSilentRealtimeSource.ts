import type { IRealtimeSource } from './realtimeTypes';

export const createSilentRealtimeSource = (): IRealtimeSource => ({
  subscribe: () => () => undefined,
});
