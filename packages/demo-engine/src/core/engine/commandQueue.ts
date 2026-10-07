export interface ICommandQueue {
  enqueue: <TResult>(job: () => Promise<TResult> | TResult) => Promise<TResult>;
}

export const createCommandQueue = (): ICommandQueue => {
  let tail: Promise<unknown> = Promise.resolve();

  const enqueue = <TResult>(job: () => Promise<TResult> | TResult): Promise<TResult> => {
    const run = tail.then(job);
    tail = run.catch(() => undefined);

    return run;
  };

  return { enqueue };
};
