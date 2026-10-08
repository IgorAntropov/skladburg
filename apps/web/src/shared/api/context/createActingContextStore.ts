import type {
  ActingContextValue,
  IActingContextStore,
} from './actingContextTypes';

export const createActingContextStore = (initial: ActingContextValue): IActingContextStore => {
  let current: ActingContextValue = { organizationId: initial.organizationId, userId: initial.userId };
  const listeners = new Set<() => void>();

  return {
    get: () => current,
    set: (context) => {
      const isUnchanged = context.organizationId === current.organizationId && context.userId === current.userId;

      if (isUnchanged) {
        return;
      }

      current = { organizationId: context.organizationId, userId: context.userId };

      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
