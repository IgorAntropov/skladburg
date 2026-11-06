import type { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IDomainErrors } from '../errors/index';

export interface IStateMachine<TCommand, TStatus, TTransition> {
  findTransition: (command: TCommand, status: TStatus) => TTransition | undefined;
  requireTransition: (
    errors: IDomainErrors,
    command: TCommand,
    current: MachineStateValue<TStatus>,
    expectedVersion: number | undefined,
  ) => TTransition;
}

export interface MachineStateValue<TStatus> {
  status: TStatus;
  version: number;
}

export interface StateMachineDefinitionValue<TCommand extends PropertyKey, TStatus extends PropertyKey, TTransition> {
  entity: EntityKind;
  intendedStatuses: Readonly<Record<TCommand, TStatus>>;
  statusName: (status: TStatus) => string;
  transitions: Readonly<Record<TCommand, Readonly<Partial<Record<TStatus, TTransition>>>>>;
}

export const createStateMachine = <
  TCommand extends PropertyKey,
  TStatus extends PropertyKey,
  TTransition extends { status: TStatus },
>(definition: StateMachineDefinitionValue<TCommand, TStatus, TTransition>): IStateMachine<TCommand, TStatus, TTransition> => {
  const findTransition: IStateMachine<TCommand, TStatus, TTransition>['findTransition'] = (command, status) =>
    definition.transitions[command][status];

  const requireTransition: IStateMachine<TCommand, TStatus, TTransition>['requireTransition'] = (
    errors,
    command,
    current,
    expectedVersion,
  ) => {
    if (expectedVersion !== undefined && expectedVersion !== current.version) {
      throw errors.versionConflict(definition.entity, current.version);
    }

    const transition = findTransition(command, current.status);

    if (transition === undefined) {
      throw errors.invalidTransition(
        definition.entity,
        definition.statusName(current.status),
        definition.statusName(definition.intendedStatuses[command]),
      );
    }

    return transition;
  };

  return { findTransition, requireTransition };
};
