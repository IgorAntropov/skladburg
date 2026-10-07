import type { IEnginePort } from '../protocol/index';
import type {
  CreateEngineHostOptionsValue,
  IBroadcastChannel,
  ILockManager,
} from './hostTypes';

import { ENGINE_DATABASE_NAME } from './constants';
import {
  createRandomUuid,
  type FillRandomBytesValue,
} from './randomUuid';
import { openEngineStorage } from './storage/index';
import { createSystemTimers } from './systemTimers';

export interface IWorkerScope extends IEnginePort {
  BroadcastChannel: new (name: string) => IBroadcastChannel;
  crypto: { getRandomValues: FillRandomBytesValue; randomUUID?: () => string };
  navigator: { locks?: ILockManager | undefined };
  performance: { now: () => number; timeOrigin: number };
}

const createIdGenerator = (scopeCrypto: IWorkerScope['crypto']): (() => string) => {
  const { randomUUID } = scopeCrypto;

  return randomUUID === undefined
    ? () => createRandomUuid(bytes => scopeCrypto.getRandomValues(bytes))
    : () => randomUUID.call(scopeCrypto);
};

export const createWorkerHostOptions = (scope: IWorkerScope): CreateEngineHostOptionsValue => ({
  broadcastChannelFactory: name => new scope.BroadcastChannel(name),
  generateId: createIdGenerator(scope.crypto),
  loadCore: () => import('../core/engine/index'),
  lockManager: scope.navigator.locks,
  openStorage: () => openEngineStorage({ databaseName: ENGINE_DATABASE_NAME }),
  port: scope,
  realTime: { now: () => scope.performance.timeOrigin + scope.performance.now() },
  timers: createSystemTimers(),
});
