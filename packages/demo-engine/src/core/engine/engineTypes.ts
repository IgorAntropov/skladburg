import type { Event } from '@skladburg/contracts/event/v1/event';

import type { EngineSubscriptionValue } from '../events/index';
import type {
  ClockSnapshotValue,
  IEngineStorage,
  IRealTimeSource,
} from '../ports/index';
import type { EngineSeedValue } from '../seed/index';
import type { DemoPersonaValue } from '../state/index';

export interface CreateEngineOptionsValue {
  epoch: string;
  realTime: IRealTimeSource;
  seed?: EngineSeedValue;
  storage: IEngineStorage;
}

export interface IDemoEngine {
  checkpoint: () => Promise<void>;
  epoch: () => string;
  getClockSnapshot: () => ClockSnapshotValue;
  handle: (request: Request) => Promise<Response>;
  listPersonas: () => readonly DemoPersonaValue[];
  reset: (epoch: string) => Promise<void>;
  subscribe: (channel: string, headers: Headers, listener: (events: readonly Event[]) => void) => EngineSubscriptionValue;
  tick: () => Promise<void>;
}
