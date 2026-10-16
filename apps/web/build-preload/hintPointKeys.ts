import type { CriticalPreloadEntryValue } from './criticalPreloadTypes.ts';

export interface HintPointKeysInputValue {
  entries: readonly CriticalPreloadEntryValue[];
  workerDynamicEntries: readonly string[];
  workerEntries: readonly string[];
}

export const toWorkerWrapperKey = (workerEntry: string): string => `${workerEntry}?worker`;

export const listHintPointKeys = ({ entries, workerDynamicEntries, workerEntries }: HintPointKeysInputValue): string[] => [
  ...entries.map(({ entry }) => entry),
  ...workerEntries.map(toWorkerWrapperKey),
  ...workerEntries,
  ...workerDynamicEntries,
];

export const assertKnownHintPointKeys = (
  optionName: string,
  keys: readonly string[],
  input: HintPointKeysInputValue,
): void => {
  const knownKeys = new Set(listHintPointKeys(input));
  const unknownKeys = keys.filter(key => !knownKeys.has(key));

  if (unknownKeys.length > 0) {
    throw new Error(`Critical preload: ${optionName} names entries the plugin does not know: ${unknownKeys.join(', ')}`);
  }
};
