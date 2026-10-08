import type { MockInstance } from 'vitest';

import {
  afterEach,
  beforeEach,
  vi,
} from 'vitest';

class ResizeObserverStub {
  disconnect(): void {
    return undefined;
  }

  observe(): void {
    return undefined;
  }

  unobserve(): void {
    return undefined;
  }
}

const readGlobalPrototype = (name: string): object | undefined => {
  const constructor: unknown = Reflect.get(globalThis, name);

  if (typeof constructor !== 'function') {
    return undefined;
  }

  const prototype: unknown = Reflect.get(constructor, 'prototype');

  return typeof prototype === 'object' && prototype !== null ? prototype : undefined;
};

const defineIfMissing = (target: object, name: string, value: unknown): void => {
  if (name in target) {
    return;
  }

  Object.defineProperty(target, name, { configurable: true, value, writable: true });
};

const installBrowserStubs = (): void => {
  const elementPrototype = readGlobalPrototype('Element');

  if (elementPrototype === undefined) {
    return;
  }

  defineIfMissing(elementPrototype, 'hasPointerCapture', () => false);
  defineIfMissing(elementPrototype, 'releasePointerCapture', () => undefined);
  defineIfMissing(elementPrototype, 'setPointerCapture', () => undefined);
  defineIfMissing(elementPrototype, 'scrollIntoView', () => undefined);
  defineIfMissing(globalThis, 'ResizeObserver', ResizeObserverStub);
};

installBrowserStubs();

let silencedConsoleLog: MockInstance<typeof console.log> | undefined;

beforeEach(() => {
  silencedConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  silencedConsoleLog?.mockRestore();
  silencedConsoleLog = undefined;
});
