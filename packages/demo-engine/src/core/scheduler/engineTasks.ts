import type { IModuleRuntime } from '../modules/index';
import type { SchedulerTaskValue } from './scheduler';

import { createSupportBotTask } from '../modules/index';

export const createEngineTasks = (runtime: IModuleRuntime): readonly SchedulerTaskValue[] => [
  createSupportBotTask(runtime),
];
