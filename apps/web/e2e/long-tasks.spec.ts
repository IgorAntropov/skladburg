import {
  expect,
  test,
} from '@playwright/test';

import {
  DEFAULT_PERSONA,
  PERSONAS,
} from './fixtures/demoData.ts';
import { LONG_TASK_LIMIT_MS } from './fixtures/performance.ts';
import { WAREHOUSE_ROUTE } from './fixtures/routes.ts';
import { createHudRobot } from './robots/hud-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPerformanceRobot } from './robots/performance-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

test.use({ viewport: { height: 900, width: 1440 } });

test.describe('long tasks of the main thread on desktop', () => {
  test('reports a task that blocks the main thread longer than the limit', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const performance = createPerformanceRobot(page);

    await performance.installRecorder();
    await navigation.openRoot();
    await navigation.expectSection('network');
    await performance.expectRecorderInstalled();
    await performance.takeLongestTaskMs();

    await performance.blockMainThread(LONG_TASK_LIMIT_MS + 100);

    await expect.poll(() => performance.takeLongestTaskMs()).toBeGreaterThan(LONG_TASK_LIMIT_MS);
  });

  test(`keeps every interaction of the main scenario within ${String(LONG_TASK_LIMIT_MS)} ms per task`, async ({ page }) => {
    const hud = createHudRobot(page, 'desktop');
    const navigation = createNavigationRobot(page);
    const performance = createPerformanceRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');
    const warehouse = createWarehouseRobot(page);
    const interactionLongestTasks: Record<string, number> = {};

    await performance.installRecorder();
    await navigation.openRoot();
    await navigation.expectSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await performance.expectRecorderInstalled();

    const startupLongestTask = await performance.takeLongestTaskMs();

    test.info().annotations.push({ description: String(startupLongestTask), type: 'startup longest task, ms' });

    await navigation.clickSectionLink('warehouse');
    await navigation.expectSection('warehouse');
    await warehouse.expectEngineData();
    interactionLongestTasks['section change'] = await performance.takeLongestTaskMs();

    await hud.openObjectInPlace(WAREHOUSE_ROUTE);
    await hud.expectInspectorOpen(WAREHOUSE_ROUTE);
    interactionLongestTasks['object in the inspector'] = await performance.takeLongestTaskMs();

    await topBar.selectTheme('dark');
    await topBar.expectDocumentTheme('dark');
    interactionLongestTasks['theme change'] = await performance.takeLongestTaskMs();

    await persona.selectPersona(PERSONAS.freshCarrier);
    await persona.expectCurrentPersona(PERSONAS.freshCarrier);
    interactionLongestTasks['persona change'] = await performance.takeLongestTaskMs();

    for (const [interaction, longestTask] of Object.entries(interactionLongestTasks)) {
      test.info().annotations.push({ description: String(longestTask), type: `longest task of ${interaction}, ms` });
    }

    for (const [interaction, longestTask] of Object.entries(interactionLongestTasks)) {
      expect.soft(longestTask, interaction).toBeLessThanOrEqual(LONG_TASK_LIMIT_MS);
    }
  });
});
