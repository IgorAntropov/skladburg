import type {
  DemoPersonaValue,
  EngineConnectionStatusValue,
} from '@skladburg/demo-engine/client';

export type DemoEngineStatusValue = EngineConnectionStatusValue;

export interface IDemoControl {
  listPersonas: () => Promise<readonly DemoPersonaValue[]>;
  onReset: (listener: (epoch: string) => void) => () => void;
  onStatus: (listener: (status: DemoEngineStatusValue) => void) => () => void;
  reset: () => Promise<void>;
}
