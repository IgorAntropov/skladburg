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
import type {
  prepareInboundShipment,
  ReceivingManifestValue,
} from './wms/inboundPlan';
import type {
  hasInboundProduct,
  openInboundTask,
} from './wms/inboundRecords';
import type { openOutboundTask } from './wms/outboundRecords';

export interface IEventOutbox {
  add: (transaction: IStateTransaction, channel: string, payload: Event['payload']) => void;
}

export interface IModuleRuntime {
  command: <TResult>(work: (transaction: IStateTransaction) => TResult) => Promise<TResult>;
  errors: IDomainErrors;
  getWorldTimeMs: () => number;
  guard: ICallGuard;
  hasInboundProduct?: typeof hasInboundProduct | undefined;
  idempotency: IIdempotencyGuard;
  notifier: INotifier;
  openInboundTask?: typeof openInboundTask | undefined;
  openOutboundTask?: typeof openOutboundTask | undefined;
  outbox: IEventOutbox;
  paymentProvider: IPaymentProvider;
  prepareInboundShipment?: typeof prepareInboundShipment | undefined;
  random: IRandom;
  read: IStateReader;
  wmsInboundManifests?: ReadonlyMap<string, ReceivingManifestValue> | undefined;
  wmsInboundWarehouseIds?: ReadonlySet<string> | undefined;
  wmsOutboundWarehouseIds?: ReadonlySet<string> | undefined;
}
