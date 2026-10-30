import type { IUuidSource } from '@skladburg/contracts/uuid';

import { createUuidGenerator } from '@skladburg/contracts/uuid';

import type { IEnginePort } from '../protocol/index';
import type {
  CreateEngineHostOptionsValue,
  IBroadcastChannel,
  ILockManager,
} from './hostTypes';

import { ENGINE_DATABASE_NAME } from './constants';
import { openEngineStorage } from './storage/index';
import { createSystemTimers } from './systemTimers';

export interface IWorkerScope extends IEnginePort {
  BroadcastChannel: new (name: string) => IBroadcastChannel;
  crypto: IUuidSource;
  navigator: { locks?: ILockManager | undefined };
  performance: { now: () => number; timeOrigin: number };
}

export const createWorkerHostOptions = (scope: IWorkerScope): CreateEngineHostOptionsValue => ({
  broadcastChannelFactory: name => new scope.BroadcastChannel(name),
  generateId: createUuidGenerator(scope.crypto),
  loadCore: () => import('../core/engine/index'),
  lockManager: scope.navigator.locks,
  openStorage: () => openEngineStorage({ databaseName: ENGINE_DATABASE_NAME }),
  port: scope,
  realTime: { now: () => scope.performance.timeOrigin + scope.performance.now() },
  timers: createSystemTimers(),
});
