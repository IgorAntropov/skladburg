import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import type { IDomainErrors } from '../errors/index';
import type { IEventBus } from '../events/index';
import type { IModuleRuntime } from '../modules/index';
import type {
  EngineChangeSetValue,
  IEngineStorage,
} from '../ports/index';
import type {
  IEngineState,
  IStateTransaction,
  LiveMetaValue,
} from '../state/index';

export type CheckpointRunnerDependenciesValue = Pick<
  CommandRunnerDependenciesValue,
  'errors' | 'readLiveMeta' | 'readWorldTimeMs' | 'state' | 'storage'
>;

export interface CommandRunnerDependenciesValue {
  bus: IEventBus;
  errors: IDomainErrors;
  readLiveMeta: () => LiveMetaValue;
  readWorldTimeMs: () => number;
  state: IEngineState;
  storage: IEngineStorage;
}

interface PreparedCommandValue<TResult> {
  result: TResult;
  transaction: IStateTransaction;
}

const commitChangeSet = async (
  storage: IEngineStorage,
  errors: IDomainErrors,
  changeSet: EngineChangeSetValue,
): Promise<void> => {
  try {
    await storage.commit(changeSet);
  }
  catch (cause) {
    throw errors.create(ErrorCode.UNAVAILABLE, undefined, cause);
  }
};

export const createCheckpointRunner = (dependencies: CheckpointRunnerDependenciesValue): (() => Promise<void>) => {
  const { errors, readLiveMeta, readWorldTimeMs, state, storage } = dependencies;

  return async (): Promise<void> => {
    const outcome = state.prepareCheckpoint(readWorldTimeMs(), readLiveMeta);

    if (outcome.changeSet === undefined) {
      return;
    }

    await commitChangeSet(storage, errors, outcome.changeSet);
    outcome.apply();
  };
};

export const createCommandRunner = (dependencies: CommandRunnerDependenciesValue): IModuleRuntime['command'] => {
  const { bus, errors, readLiveMeta, readWorldTimeMs, state, storage } = dependencies;

  return async <TResult>(work: (transaction: IStateTransaction) => TResult): Promise<TResult> => {
    const outcome = state.transact<PreparedCommandValue<TResult>>(
      readWorldTimeMs(),
      transaction => ({ result: work(transaction), transaction }),
      readLiveMeta,
    );

    if (outcome.changeSet !== undefined) {
      await commitChangeSet(storage, errors, outcome.changeSet);
    }

    outcome.apply();
    bus.publish(outcome.result.transaction);

    return outcome.result.result;
  };
};
