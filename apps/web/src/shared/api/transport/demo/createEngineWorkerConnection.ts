import type {
  DemoScenarioValue,
  IEngineConnection,
} from '@skladburg/demo-engine/client';

import type { IEngineWorker } from './connectToEngineWorker';

import { connectToEngineWorker } from './connectToEngineWorker';

const createDefaultEngineWorker = async (scenario: DemoScenarioValue | undefined): Promise<IEngineWorker> => {
  const { default: EngineWorker } = await import('@skladburg/demo-engine/worker?worker');

  return scenario === undefined ? new EngineWorker() : new EngineWorker({ name: scenario });
};

export const createEngineWorkerConnection = async (
  createWorker: (scenario: DemoScenarioValue | undefined) => Promise<IEngineWorker> = createDefaultEngineWorker,
  scenario?: DemoScenarioValue,
): Promise<IEngineConnection> => connectToEngineWorker(await createWorker(scenario));
