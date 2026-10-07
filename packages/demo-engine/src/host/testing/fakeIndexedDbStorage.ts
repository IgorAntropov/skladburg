import type { IEngineStorage } from '../../core/ports/index';
import type { IIndexedDbEngineStorage } from '../storage/index';

import { createMemoryStorage } from '../../core/ports/index';

export interface FakeIndexedDbStorageValue extends IIndexedDbEngineStorage {
  clearCount: () => number;
  closeCount: () => number;
  failWrites: (error: Error | undefined) => void;
  writeAttemptCount: () => number;
}

export const createFakeIndexedDbStorage = (inner: IEngineStorage = createMemoryStorage()): FakeIndexedDbStorageValue => {
  let clears = 0;
  let closes = 0;
  let writeAttempts = 0;
  let writeError: Error | undefined;

  const guardWrite = (write: () => Promise<void>): Promise<void> => {
    writeAttempts += 1;

    return writeError === undefined ? write() : Promise.reject(writeError);
  };

  return {
    clear: () => {
      clears += 1;

      return Promise.resolve();
    },
    clearCount: () => clears,
    close: () => {
      closes += 1;
    },
    closeCount: () => closes,
    commit: changeSet => guardWrite(() => inner.commit(changeSet)),
    failWrites: (error) => {
      writeError = error;
    },
    load: () => inner.load(),
    replaceAll: snapshot => guardWrite(() => inner.replaceAll(snapshot)),
    writeAttemptCount: () => writeAttempts,
  };
};
