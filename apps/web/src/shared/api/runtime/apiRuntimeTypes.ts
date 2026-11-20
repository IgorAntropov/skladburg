import type { ApiClient } from '../client/apiClientTypes';
import type {
  ActingContextValue,
  IActingContextStore,
} from '../context/actingContextTypes';
import type { IErrorJournal } from '../errors/errorJournal';
import type {
  IFrameScheduler,
  IRealtimeChannel,
} from '../realtime/realtimeTypes';
import type {
  DemoScenarioValue,
  IDemoControl,
  IEngineConnection,
} from '../transport/demo';

export interface ApiRuntimeValue {
  actingContext: IActingContextStore;
  client: ApiClient;
  close: () => void;
  demoControl: IDemoControl | undefined;
  demoScenario?: DemoScenarioControlValue | undefined;
  errorJournal: IErrorJournal;
  networkMode: QueryNetworkModeValue;
  realtime: IRealtimeChannel;
}

export interface CreateApiRuntimeOptionsValue {
  connection?: IEngineConnection | undefined;
  defaultOrganizationId: string;
  demoScenario?: DemoScenarioValue | undefined;
  frameScheduler?: IFrameScheduler | undefined;
  preferredContext?: ActingContextValue | undefined;
  preferredPersonaId?: string | undefined;
}

export interface DemoScenarioControlValue {
  change: (scenario: DemoScenarioValue | undefined, path: string) => boolean;
  current: DemoScenarioValue | undefined;
}

export type QueryNetworkModeValue = 'always' | 'online';
