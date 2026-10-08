import type { ApiClient } from '../client/apiClientTypes';
import type {
  ActingContextValue,
  IActingContextStore,
} from '../context/actingContextTypes';
import type {
  IFrameScheduler,
  IRealtimeChannel,
} from '../realtime/realtimeTypes';
import type {
  IDemoControl,
  IEngineConnection,
} from '../transport/demo';

export interface ApiRuntimeValue {
  actingContext: IActingContextStore;
  client: ApiClient;
  close: () => void;
  demoControl: IDemoControl | undefined;
  networkMode: QueryNetworkModeValue;
  realtime: IRealtimeChannel;
}

export interface CreateApiRuntimeOptionsValue {
  connection?: IEngineConnection | undefined;
  defaultOrganizationId: string;
  frameScheduler?: IFrameScheduler | undefined;
  preferredContext?: ActingContextValue | undefined;
  preferredPersonaId?: string | undefined;
}

export type QueryNetworkModeValue = 'always' | 'online';
