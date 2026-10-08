import type { IRealtimeChannel } from '../realtime/realtimeTypes';

import { useApiRuntime } from './useApiRuntime';

export const useRealtimeChannel = (): IRealtimeChannel => {
  return useApiRuntime().realtime;
};
