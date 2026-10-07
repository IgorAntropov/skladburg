import type { IEngineStorage } from '../core/ports/index';
import type { EngineStatusValue } from '../protocol/index';

export interface CreateStorageHealthMonitorOptionsValue {
  onChange: (health: StorageHealthValue) => void;
}

export interface IStorageHealthMonitor {
  health: () => StorageHealthValue;
  wrap: (storage: IEngineStorage) => IEngineStorage;
}

export type StorageHealthValue = EngineStatusValue['storageHealth'];

export const createStorageHealthMonitor = (options: CreateStorageHealthMonitorOptionsValue): IStorageHealthMonitor => {
  let current: StorageHealthValue = 'ok';

  const report = (next: StorageHealthValue, error: unknown): void => {
    if (next === current) {
      return;
    }

    current = next;
    console.log('> EngineHost -> storageHealth:', { error, health: next });
    options.onChange(next);
  };

  const track = async (write: () => Promise<void>): Promise<void> => {
    try {
      await write();
    }
    catch (error) {
      report('failing', error);

      throw error;
    }

    report('ok', undefined);
  };

  const wrap = (storage: IEngineStorage): IEngineStorage => ({
    commit: changeSet => track(() => storage.commit(changeSet)),
    load: () => storage.load(),
    replaceAll: snapshot => track(() => storage.replaceAll(snapshot)),
  });

  return { health: () => current, wrap };
};
