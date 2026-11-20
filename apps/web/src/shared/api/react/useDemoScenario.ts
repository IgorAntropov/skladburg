import type { DemoScenarioControlValue } from '../runtime/apiRuntimeTypes';

import { useApiRuntime } from './useApiRuntime';

export const useDemoScenario = (): DemoScenarioControlValue | undefined => useApiRuntime().demoScenario;
