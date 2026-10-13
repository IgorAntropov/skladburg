import type { TerrainWorkerRequestValue } from './terrainWorkerProtocol';

import { handleTerrainRequest } from './handleTerrainRequest';

self.addEventListener('message', (event: MessageEvent<TerrainWorkerRequestValue>) => {
  const { response, transfer } = handleTerrainRequest(event.data);

  self.postMessage(response, { transfer });
});
