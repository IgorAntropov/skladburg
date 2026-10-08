import type { IEngineConnection } from '@skladburg/demo-engine/client';

import type { IEngineWorker } from './connectToEngineWorker';

import { connectToEngineWorker } from './connectToEngineWorker';

const createDefaultEngineWorker = async (): Promise<IEngineWorker> => {
  const { default: EngineWorker } = await import('@skladburg/demo-engine/worker?worker');

  return new EngineWorker();
};

export const createEngineWorkerConnection = async (
  createWorker: () => Promise<IEngineWorker> = createDefaultEngineWorker,
): Promise<IEngineConnection> => connectToEngineWorker(await createWorker());
