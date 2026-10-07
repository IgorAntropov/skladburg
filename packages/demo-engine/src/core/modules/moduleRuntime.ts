import type { Event } from '@skladburg/contracts/event/v1/event';

import type { ICallGuard } from '../access/index';
import type { IDomainErrors } from '../errors/index';
import type { IIdempotencyGuard } from '../idempotency/index';
import type { IRandom } from '../ports/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../state/index';

export interface IEventOutbox {
  add: (transaction: IStateTransaction, channel: string, payload: Event['payload']) => void;
}

export interface IModuleRuntime {
  command: <TResult>(work: (transaction: IStateTransaction) => TResult) => Promise<TResult>;
  errors: IDomainErrors;
  guard: ICallGuard;
  idempotency: IIdempotencyGuard;
  outbox: IEventOutbox;
  random: IRandom;
  read: IStateReader;
}
