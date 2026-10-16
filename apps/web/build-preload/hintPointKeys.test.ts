import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  assertKnownHintPointKeys,
  listHintPointKeys,
} from './hintPointKeys.ts';

const INPUT = {
  entries: [{ entry: 'src/mountApp.ts', isRequired: true }],
  workerDynamicEntries: ['demo-engine/src/core/engine/index.ts'],
  workerEntries: ['demo-engine/src/host/worker.ts'],
};

describe('listHintPointKeys', () => {
  it('names the entries, the wrapper and the script of the worker and its dynamic points', () => {
    expect(listHintPointKeys(INPUT)).toEqual([
      'src/mountApp.ts',
      'demo-engine/src/host/worker.ts?worker',
      'demo-engine/src/host/worker.ts',
      'demo-engine/src/core/engine/index.ts',
    ]);
  });
});

describe('assertKnownHintPointKeys', () => {
  it('accepts the names of the points', () => {
    expect(() => {
      assertKnownHintPointKeys('deferredEntries', listHintPointKeys(INPUT), INPUT);
    }).not.toThrow();
  });

  it('names the option and the unknown entries', () => {
    expect(() => {
      assertKnownHintPointKeys('deferredEntries', ['src/mountApp.ts', 'src/missing.ts', 'src/other.ts'], INPUT);
    }).toThrow('Critical preload: deferredEntries names entries the plugin does not know: src/missing.ts, src/other.ts');
  });
});
