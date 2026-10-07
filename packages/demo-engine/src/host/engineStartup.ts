import type { IDemoEngine } from '../core/engine/index';
import type { IRealTimeSource } from '../core/ports/index';
import type { EngineStatusValue } from '../protocol/index';
import type { CoreModuleValue } from './hostTypes';
import type { OpenedEngineStorageValue } from './storage/index';
import type { IStorageHealthMonitor } from './storageHealthMonitor';

import { createMemoryStorage } from '../core/ports/index';

export interface EngineStartupOptionsValue {
  generateId: () => string;
  loadCore: () => Promise<CoreModuleValue>;
  openStorage: () => Promise<OpenedEngineStorageValue>;
  realTime: IRealTimeSource;
  storageHealthMonitor: IStorageHealthMonitor;
}

export interface StartedEngineValue {
  closeStorage: () => void;
  engine: IDemoEngine;
  storage: EngineStatusValue['storage'];
  storageHealth: EngineStatusValue['storageHealth'];
}

const openStorageOrMemory = async (openStorage: () => Promise<OpenedEngineStorageValue>): Promise<OpenedEngineStorageValue> => {
  try {
    return await openStorage();
  }
  catch (error) {
    console.log('> EngineHost -> openStorageOrMemory:', { error });

    return { kind: 'memory', storage: createMemoryStorage() };
  }
};

export const startEngine = async (options: EngineStartupOptionsValue): Promise<StartedEngineValue> => {
  const { createEngine } = await options.loadCore();
  const opened = await openStorageOrMemory(options.openStorage);

  const create = (storage: OpenedEngineStorageValue['storage']): Promise<IDemoEngine> => createEngine({
    epoch: options.generateId(),
    realTime: options.realTime,
    storage,
  });

  if (opened.kind === 'memory') {
    return { closeStorage: () => undefined, engine: await create(opened.storage), storage: 'memory', storageHealth: 'ok' };
  }

  const closeIndexedDb = (): void => {
    opened.storage.close();
  };

  const startOnIndexedDb = async (): Promise<StartedEngineValue> => {
    const engine = await create(options.storageHealthMonitor.wrap(opened.storage));

    return { closeStorage: closeIndexedDb, engine, storage: 'indexed-db', storageHealth: options.storageHealthMonitor.health() };
  };

  try {
    return await startOnIndexedDb();
  }
  catch (error) {
    console.log('> EngineHost -> startEngine:', { error, step: 'load' });
  }

  try {
    await opened.storage.clear();

    return await startOnIndexedDb();
  }
  catch (error) {
    console.log('> EngineHost -> startEngine:', { error, step: 'retry' });
    closeIndexedDb();
  }

  return { closeStorage: () => undefined, engine: await create(createMemoryStorage()), storage: 'memory', storageHealth: 'ok' };
};
