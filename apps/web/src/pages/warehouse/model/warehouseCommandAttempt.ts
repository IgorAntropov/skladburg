export type WarehouseCommandAttemptValue<TResult> = (idempotencyKey: string, execute: () => Promise<TResult>) => Promise<TResult>;

export const createWarehouseCommandAttempt = <TResult>(): WarehouseCommandAttemptValue<TResult> => {
  let current: undefined | { execute: () => Promise<TResult>; idempotencyKey: string };

  return (idempotencyKey, execute) => {
    if (current?.idempotencyKey !== idempotencyKey) {
      current = { execute, idempotencyKey };
    }

    return current.execute();
  };
};
