import type {
  WorldTerrainParamsValue,
  WorldTerrainValue,
} from './terrainTypes';
import type { TerrainWorkerResponseValue } from './terrainWorkerProtocol';

import { TERRAIN_WORKER_TIMEOUT_MS } from './terrainConstants';

export interface ITerrainWorker {
  addEventListener: (type: 'error' | 'message' | 'messageerror', listener: (event: Event) => void) => void;
  postMessage: (message: unknown) => void;
  terminate: () => void;
}

export type TerrainGenerationSourceValue = 'main' | 'worker';

export interface TerrainGenerationValue {
  generationMs: number;
  source: TerrainGenerationSourceValue;
  terrain: WorldTerrainValue;
}

const createDefaultTerrainWorker = (): ITerrainWorker => {
  return new Worker(new URL('./worldTerrain.worker.ts', import.meta.url), { type: 'module' });
};

const isMessageEvent = (event: Event): event is MessageEvent<TerrainWorkerResponseValue> => event instanceof MessageEvent;

export const runTerrainInWorker = (
  params: WorldTerrainParamsValue,
  createWorker: () => ITerrainWorker = createDefaultTerrainWorker,
  timeoutMs: number = TERRAIN_WORKER_TIMEOUT_MS,
): Promise<TerrainGenerationValue> => {
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error('The terrain worker did not answer in time'));
    }, timeoutMs);

    worker.addEventListener('message', (event) => {
      clearTimeout(timeoutId);
      worker.terminate();

      if (isMessageEvent(event)) {
        resolve({ generationMs: event.data.generationMs, source: 'worker', terrain: event.data.terrain });
      }
      else {
        reject(new Error('The terrain worker sent an unexpected message'));
      }
    });
    worker.addEventListener('error', () => {
      clearTimeout(timeoutId);
      worker.terminate();
      reject(new Error('The terrain worker failed'));
    });
    worker.addEventListener('messageerror', () => {
      clearTimeout(timeoutId);
      worker.terminate();
      reject(new Error('The terrain worker sent a message that could not be read'));
    });
    worker.postMessage({ params });
  });
};
