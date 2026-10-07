import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import type { IDomainErrors } from '../errors/index';
import type { IEventBus } from '../events/index';
import type { IModuleRuntime } from '../modules/index';
import type { IEngineStorage } from '../ports/index';
import type {
  IEngineState,
  IStateTransaction,
  LiveMetaValue,
} from '../state/index';

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

export const createCommandRunner = (dependencies: CommandRunnerDependenciesValue): IModuleRuntime['command'] => {
  const { bus, errors, readLiveMeta, readWorldTimeMs, state, storage } = dependencies;

  return async <TResult>(work: (transaction: IStateTransaction) => TResult): Promise<TResult> => {
    const outcome = state.transact<PreparedCommandValue<TResult>>(
      readWorldTimeMs(),
      transaction => ({ result: work(transaction), transaction }),
      readLiveMeta,
    );

    if (outcome.changeSet !== undefined) {
      try {
        await storage.commit(outcome.changeSet);
      }
      catch (cause) {
        throw errors.create(ErrorCode.UNAVAILABLE, undefined, cause);
      }
    }

    outcome.apply();
    bus.publish(outcome.result.transaction);

    return outcome.result.result;
  };
};
