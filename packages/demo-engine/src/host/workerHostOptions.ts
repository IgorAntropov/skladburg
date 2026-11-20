import type { IUuidSource } from '@skladburg/contracts/uuid';

import { createUuidGenerator } from '@skladburg/contracts/uuid';

import type { IEnginePort } from '../protocol/index';
import type {
  CreateEngineHostOptionsValue,
  IBroadcastChannel,
  ILockManager,
} from './hostTypes';

import { WAREHOUSE_YARD_MORNING } from '../protocol/demoScenario';
import { ENGINE_DATABASE_NAME } from './constants';
import { openEngineStorage } from './storage/index';
import { createSystemTimers } from './systemTimers';

export interface IWorkerScope extends IEnginePort {
  BroadcastChannel: new (name: string) => IBroadcastChannel;
  crypto: IUuidSource;
  name?: string | undefined;
  navigator: { locks?: ILockManager | undefined };
  performance: { now: () => number; timeOrigin: number };
}

export const createWorkerHostOptions = (scope: IWorkerScope): CreateEngineHostOptionsValue => {
  const demoScenario = scope.name === WAREHOUSE_YARD_MORNING ? WAREHOUSE_YARD_MORNING : undefined;
  const locks = scope.navigator.locks;
  const namespace = (name: string): string => demoScenario === undefined ? name : `${name}:${demoScenario}`;
  const lockManager: ILockManager | undefined = locks === undefined || demoScenario === undefined
    ? locks
    : { request: (name, options, callback) => locks.request(namespace(name), options, callback) };

  return {
    broadcastChannelFactory: name => new scope.BroadcastChannel(namespace(name)),
    demoScenario,
    generateId: createUuidGenerator(scope.crypto),
    isDemoWarehouseEnabled: true,
    loadCore: () => import('../core/engine/index'),
    lockManager,
    openStorage: () => openEngineStorage({ databaseName: namespace(ENGINE_DATABASE_NAME) }),
    port: scope,
    realTime: { now: () => scope.performance.timeOrigin + scope.performance.now() },
    timers: createSystemTimers(),
  };
};
