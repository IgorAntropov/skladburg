import type { IBroadcastChannel } from '../hostTypes';

export const createDetachedBroadcastChannel = (): IBroadcastChannel => ({
  addEventListener: () => undefined,
  close: () => undefined,
  postMessage: () => undefined,
  removeEventListener: () => undefined,
});
