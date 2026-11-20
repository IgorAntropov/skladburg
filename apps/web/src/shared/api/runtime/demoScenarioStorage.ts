import type { DemoScenarioValue } from '../transport/demo';

import { ACTING_CONTEXT_STORAGE_KEY } from '../context/actingContextPersistence';
import { WAREHOUSE_YARD_MORNING } from '../transport/demo/demoScenario';

const DEMO_SCENARIO_KEY = 'demo-scenario';

export const WAREHOUSE_YARD_MORNING_WAREHOUSE_ID = '80000003-0000-4000-8000-000000000000';
export const WAREHOUSE_YARD_MORNING_ORGANIZATION_ID = '10000001-0000-4000-8000-000000000000';

export const getDemoScenarioContextKey = (scenario: DemoScenarioValue | undefined): string => (
  scenario === undefined ? ACTING_CONTEXT_STORAGE_KEY : `${ACTING_CONTEXT_STORAGE_KEY}:${scenario}`
);

export const readDemoScenario = (storage: Storage | undefined): DemoScenarioValue | undefined => {
  try {
    return storage?.getItem(DEMO_SCENARIO_KEY) === WAREHOUSE_YARD_MORNING ? WAREHOUSE_YARD_MORNING : undefined;
  }
  catch (error) {
    console.log('> demoScenarioStorage -> readDemoScenario:', { error });

    return undefined;
  }
};

export const writeDemoScenario = (storage: Storage, scenario: DemoScenarioValue | undefined): boolean => {
  try {
    if (scenario === undefined) {
      storage.removeItem(DEMO_SCENARIO_KEY);
    }
    else {
      storage.removeItem(getDemoScenarioContextKey(scenario));
      storage.setItem(DEMO_SCENARIO_KEY, scenario);
    }

    return true;
  }
  catch (error) {
    console.log('> demoScenarioStorage -> writeDemoScenario:', { error });

    return false;
  }
};
