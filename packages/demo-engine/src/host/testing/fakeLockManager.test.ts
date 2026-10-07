import {
  describe,
  expect,
  it,
} from 'vitest';

import { settleMicrotasks } from '../../core/engine/testing/engineHarness';
import { createFakeLockManager } from './fakeLockManager';

const LOCK = 'lock';

const createHolder = (): { callback: () => Promise<void>; entered: () => boolean; release: () => void } => {
  let release: () => void = () => undefined;
  let isEntered = false;

  return {
    callback: async () => {
      isEntered = true;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    entered: () => isEntered,
    release: () => {
      release();
    },
  };
};

describe('createFakeLockManager', () => {
  it('grants the lock to the first requester and queues the rest in order', async () => {
    const manager = createFakeLockManager();
    const first = createHolder();
    const second = createHolder();
    const third = createHolder();
    const controller = new AbortController();

    void manager.request(LOCK, { signal: controller.signal }, first.callback);
    void manager.request(LOCK, { signal: controller.signal }, second.callback);
    void manager.request(LOCK, { signal: controller.signal }, third.callback);
    await settleMicrotasks();

    expect([first.entered(), second.entered(), third.entered()]).toEqual([true, false, false]);
    expect(manager.waitingCount(LOCK)).toBe(2);

    first.release();
    await settleMicrotasks();

    expect([second.entered(), third.entered()]).toEqual([true, false]);

    second.release();
    await settleMicrotasks();

    expect(third.entered()).toBe(true);
  });

  it('frees the lock when the callback promise settles, also when it rejects', async () => {
    const manager = createFakeLockManager();
    const controller = new AbortController();
    const second = createHolder();

    const failed = manager.request(LOCK, { signal: controller.signal }, () => Promise.reject(new Error('failure')));
    void manager.request(LOCK, { signal: controller.signal }, second.callback);

    await expect(failed).rejects.toThrow('failure');
    await settleMicrotasks();

    expect(second.entered()).toBe(true);
    expect(manager.isHeld(LOCK)).toBe(true);

    second.release();
    await settleMicrotasks();

    expect(manager.isHeld(LOCK)).toBe(false);
  });

  it('rejects an aborted waiting request and keeps the holder', async () => {
    const manager = createFakeLockManager();
    const holder = createHolder();
    const waiting = createHolder();
    const controller = new AbortController();

    void manager.request(LOCK, { signal: new AbortController().signal }, holder.callback);
    const request = manager.request(LOCK, { signal: controller.signal }, waiting.callback);
    await settleMicrotasks();
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    holder.release();
    await settleMicrotasks();

    expect(waiting.entered()).toBe(false);
    expect(manager.waitingCount(LOCK)).toBe(0);
  });

  it('rejects a request whose signal is already aborted', async () => {
    const manager = createFakeLockManager();
    const controller = new AbortController();
    controller.abort();

    await expect(manager.request(LOCK, { signal: controller.signal }, () => Promise.resolve())).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('grants the lock to the next waiter on a forced release while the callback of the holder is still pending', async () => {
    const manager = createFakeLockManager();
    const controller = new AbortController();
    const holder = createHolder();
    const next = createHolder();

    void manager.request(LOCK, { signal: controller.signal }, holder.callback);
    void manager.request(LOCK, { signal: controller.signal }, next.callback);
    await settleMicrotasks();

    expect(manager.forceRelease(LOCK)).toBe(true);
    await settleMicrotasks();

    expect(next.entered()).toBe(true);
    expect(manager.isHeld(LOCK)).toBe(true);
    expect(manager.waitingCount(LOCK)).toBe(0);
  });

  it('keeps the new holder when the callback of the force-released holder settles late', async () => {
    const manager = createFakeLockManager();
    const controller = new AbortController();
    const holder = createHolder();
    const next = createHolder();
    const third = createHolder();

    void manager.request(LOCK, { signal: controller.signal }, holder.callback);
    void manager.request(LOCK, { signal: controller.signal }, next.callback);
    void manager.request(LOCK, { signal: controller.signal }, third.callback);
    await settleMicrotasks();
    manager.forceRelease(LOCK);
    await settleMicrotasks();

    holder.release();
    await settleMicrotasks();

    expect(manager.isHeld(LOCK)).toBe(true);
    expect(third.entered()).toBe(false);
    expect(manager.waitingCount(LOCK)).toBe(1);

    next.release();
    await settleMicrotasks();

    expect(third.entered()).toBe(true);
  });

  it('reports false when a forced release finds nobody holding the lock', () => {
    const manager = createFakeLockManager();

    expect(manager.forceRelease(LOCK)).toBe(false);
    expect(manager.isHeld(LOCK)).toBe(false);
  });

  it('keeps the lock occupied until the occupier is released and records every requested name', async () => {
    const manager = createFakeLockManager();
    const controller = new AbortController();
    const waiting = createHolder();
    const release = manager.occupy(LOCK);

    void manager.request(LOCK, { signal: controller.signal }, waiting.callback);
    await settleMicrotasks();

    expect(waiting.entered()).toBe(false);
    expect(manager.isHeld(LOCK)).toBe(true);

    release();
    await settleMicrotasks();

    expect(waiting.entered()).toBe(true);
    expect(manager.requestedNames()).toEqual([LOCK, LOCK]);
  });
});
