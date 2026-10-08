import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { observeLongTasks } from './observeLongTasks';

type FakeCallback = (list: { getEntries: () => IFakeEntry[] }) => void;

interface IFakeEntry {
  duration: number;
  startTime: number;
}

const createFakeObserverClass = (supportedEntryTypes: string[]): {
  disconnect: ReturnType<typeof vi.fn>;
  emit: (entries: IFakeEntry[]) => void;
  instances: () => number;
  observe: ReturnType<typeof vi.fn>;
} => {
  const disconnect = vi.fn();
  const observe = vi.fn();
  const callbacks: FakeCallback[] = [];

  class FakePerformanceObserver {
    static supportedEntryTypes = supportedEntryTypes;

    disconnect = disconnect;

    observe = observe;

    constructor(callback: FakeCallback) {
      callbacks.push(callback);
    }
  }

  vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);

  return {
    disconnect,
    emit: (entries) => {
      callbacks.forEach((callback) => {
        callback({ getEntries: () => entries });
      });
    },
    instances: () => callbacks.length,
    observe,
  };
};

describe('observeLongTasks', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('observes longtask entries with buffering', () => {
    const fake = createFakeObserverClass(['longtask']);

    observeLongTasks();

    expect(fake.instances()).toBe(1);
    expect(fake.observe).toHaveBeenCalledExactlyOnceWith({ buffered: true, type: 'longtask' });
  });

  it('warns only about entries longer than 50 ms', () => {
    const fake = createFakeObserverClass(['longtask']);

    observeLongTasks();
    fake.emit([
      { duration: 50, startTime: 10 },
      { duration: 49.9, startTime: 20 },
      { duration: 50.1, startTime: 30 },
      { duration: 120, startTime: 40 },
    ]);

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenNthCalledWith(1, '> observeLongTasks -> entry:', { duration: 50.1, startTime: 30 });
    expect(console.warn).toHaveBeenNthCalledWith(2, '> observeLongTasks -> entry:', { duration: 120, startTime: 40 });
  });

  it('stays silent when no entry is long', () => {
    const fake = createFakeObserverClass(['longtask']);

    observeLongTasks();
    fake.emit([{ duration: 12, startTime: 1 }]);

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('does not create an observer when longtask is not supported', () => {
    const fake = createFakeObserverClass(['mark', 'measure']);

    const stop = observeLongTasks();

    expect(fake.instances()).toBe(0);
    expect(fake.observe).not.toHaveBeenCalled();
    expect(() => {
      stop();
    }).not.toThrow();
    expect(fake.disconnect).not.toHaveBeenCalled();
  });

  it('does nothing when PerformanceObserver is missing', () => {
    vi.stubGlobal('PerformanceObserver', undefined);

    const stop = observeLongTasks();

    expect(() => {
      stop();
    }).not.toThrow();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('disconnects the observer on stop and tolerates repeated stops', () => {
    const fake = createFakeObserverClass(['longtask']);

    const stop = observeLongTasks();
    stop();
    stop();

    expect(fake.disconnect).toHaveBeenCalledTimes(1);
  });
});
