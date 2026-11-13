import type { Event } from '@skladburg/contracts/event/v1/event';

import type { EngineSubscriptionValue } from '../events/index';
import type { ReceivingManifestValue } from '../modules/wms/inboundPlan';
import type {
  ClockSnapshotValue,
  IEngineStorage,
  IRealTimeSource,
} from '../ports/index';
import type { DemoPersonaListItemValue } from '../protocol';
import type { EngineSeedValue } from '../seed/seedConfig';

export interface CreateEngineOptionsValue {
  epoch: string;
  isDemoWarehouseEnabled?: boolean | undefined;
  realTime: IRealTimeSource;
  seed?: EngineSeedValue;
  storage: IEngineStorage;
  wmsInboundManifests?: ReadonlyMap<string, ReceivingManifestValue> | undefined;
  wmsInboundWarehouseIds?: readonly string[] | undefined;
  wmsOutboundWarehouseIds?: readonly string[] | undefined;
}

export interface IDemoEngine {
  checkpoint: () => Promise<void>;
  epoch: () => string;
  getClockSnapshot: () => ClockSnapshotValue;
  handle: (request: Request) => Promise<Response>;
  listPersonas: () => readonly DemoPersonaListItemValue[];
  reset: (epoch: string) => Promise<void>;
  subscribe: (channel: string, headers: Headers, listener: (events: readonly Event[]) => void) => EngineSubscriptionValue;
  tick: () => Promise<void>;
}
