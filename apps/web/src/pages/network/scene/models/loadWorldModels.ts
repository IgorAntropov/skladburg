import type { IWorldModelLoader } from './createWorldModelLoader';

import { createWorldModelLoader } from './createWorldModelLoader';

const fetchWorldModelBuffer = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`World model: request ${url} failed with status ${String(response.status)}`);
  }

  return response.arrayBuffer();
};

export const loadWorldModels: IWorldModelLoader = createWorldModelLoader(fetchWorldModelBuffer);
