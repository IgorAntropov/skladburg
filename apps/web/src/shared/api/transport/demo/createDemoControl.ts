import type { IEngineConnection } from '@skladburg/demo-engine/client';

import type { IDemoControl } from './demoControlTypes';

export const createDemoControl = (connection: IEngineConnection): IDemoControl => ({
  listPersonas: () => connection.control.listPersonas(),
  onReset: listener => connection.control.onReset(listener),
  onStatus: listener => connection.onStatus(listener),
  reset: () => connection.control.reset(),
});
