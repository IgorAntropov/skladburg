import type { IModuleRuntime } from '../modules/index';
import type { SchedulerTaskValue } from './scheduler';

import {
  createDealDeadlineTask,
  createSupportAccessExpiryTask,
  createSupportBotTask,
} from '../modules/index';

export const createEngineTasks = (runtime: IModuleRuntime): readonly SchedulerTaskValue[] => [
  createSupportBotTask(runtime),
  createSupportAccessExpiryTask(runtime),
  createDealDeadlineTask(runtime),
];
