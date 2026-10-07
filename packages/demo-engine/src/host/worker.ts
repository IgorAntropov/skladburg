import { createEngineHost } from './createEngineHost';
import { createWorkerHostOptions } from './workerHostOptions';

createEngineHost(createWorkerHostOptions(self));
