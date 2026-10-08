import type {
  DemoPersonaListItemValue,
  EngineConnectionStatusValue,
} from '@skladburg/demo-engine/client';

export type DemoEngineStatusValue = EngineConnectionStatusValue;

export interface IDemoControl {
  listPersonas: () => Promise<readonly DemoPersonaListItemValue[]>;
  onReset: (listener: (epoch: string) => void) => () => void;
  onStatus: (listener: (status: DemoEngineStatusValue) => void) => () => void;
  reset: () => Promise<void>;
}
