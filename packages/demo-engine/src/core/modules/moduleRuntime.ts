import type { Event } from '@skladburg/contracts/event/v1/event';

import type { ICallGuard } from '../access/index';
import type { IDomainErrors } from '../errors/index';
import type { IIdempotencyGuard } from '../idempotency/index';
import type { IRandom } from '../ports/index';
import type { IPaymentProvider } from '../ports/paymentProvider';
import type {
  IStateReader,
  IStateTransaction,
} from '../state/index';
import type { INotifier } from './notifications/notifierTypes';
import type { openOutboundTask } from './wms/outboundRecords';

export interface IEventOutbox {
  add: (transaction: IStateTransaction, channel: string, payload: Event['payload']) => void;
}

export interface IModuleRuntime {
  command: <TResult>(work: (transaction: IStateTransaction) => TResult) => Promise<TResult>;
  errors: IDomainErrors;
  getWorldTimeMs: () => number;
  guard: ICallGuard;
  idempotency: IIdempotencyGuard;
  notifier: INotifier;
  openOutboundTask?: typeof openOutboundTask | undefined;
  outbox: IEventOutbox;
  paymentProvider: IPaymentProvider;
  random: IRandom;
  read: IStateReader;
  wmsOutboundWarehouseIds?: ReadonlySet<string> | undefined;
}
