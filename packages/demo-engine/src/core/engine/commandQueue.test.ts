import {
  describe,
  expect,
  it,
} from 'vitest';

import { createCommandQueue } from './commandQueue';

interface DeferredValue {
  promise: Promise<void>;
  resolve: () => void;
}

const createDeferred = (): DeferredValue => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
};

describe('createCommandQueue', () => {
  it('runs jobs one after another in the order they were queued', async () => {
    const queue = createCommandQueue();
    const log: string[] = [];
    const first = createDeferred();

    const firstRun = queue.enqueue(async () => {
      log.push('first:start');
      await first.promise;
      log.push('first:end');
    });
    const secondRun = queue.enqueue(() => {
      log.push('second:start');
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(log).toEqual(['first:start']);

    first.resolve();
    await Promise.all([firstRun, secondRun]);

    expect(log).toEqual(['first:start', 'first:end', 'second:start']);
  });

  it('returns the result of each job', async () => {
    const queue = createCommandQueue();

    const results = await Promise.all([queue.enqueue(() => 1), queue.enqueue(() => Promise.resolve('two'))]);

    expect(results).toEqual([1, 'two']);
  });

  it('rejects the failed job and still runs the next one', async () => {
    const queue = createCommandQueue();
    const failed = queue.enqueue(() => Promise.reject(new Error('failed')));
    const next = queue.enqueue(() => 'next');

    await expect(failed).rejects.toThrow('failed');
    await expect(next).resolves.toBe('next');
  });

  it('accepts a job queued after the queue went idle', async () => {
    const queue = createCommandQueue();
    await queue.enqueue(() => 1);

    await expect(queue.enqueue(() => 2)).resolves.toBe(2);
  });
});
