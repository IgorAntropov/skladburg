import type {
  IEngineConnection,
  IEnginePort,
} from '@skladburg/demo-engine/client';

import { connectToEngine } from '@skladburg/demo-engine/client';

export interface IEngineWorker extends IEnginePort {
  terminate: () => void;
}

export const connectToEngineWorker = (worker: IEngineWorker): IEngineConnection => {
  const connection = connectToEngine(worker);
  let isClosed = false;

  const close = (): void => {
    if (isClosed) {
      return;
    }

    isClosed = true;

    try {
      connection.close();
    }
    finally {
      worker.terminate();
    }
  };

  return { ...connection, close };
};
