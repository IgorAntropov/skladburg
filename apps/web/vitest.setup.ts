import type { MockInstance } from 'vitest';

import {
  afterEach,
  beforeEach,
  vi,
} from 'vitest';

let silencedConsoleLog: MockInstance<typeof console.log> | undefined;

beforeEach(() => {
  silencedConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  silencedConsoleLog?.mockRestore();
  silencedConsoleLog = undefined;
});
