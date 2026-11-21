import type { Locator } from '@playwright/test';

import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseEquipmentService,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { randomUUID } from 'node:crypto';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { freezeEngineClock } from './fixtures/engineClock.ts';
import {
  toObjectHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import { createAssistantRobot } from './robots/assistant-robot.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

const SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };
const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(SCOPE.warehouseId));
const DRIVER = { ...DEAL_CUSTOMER, userId: '20000032-0000-4000-8000-000000000000' };
const SSCC = '000000000000000017';

interface PointValue {
  x: number;
  y: number;
}

const distance = (first: PointValue, second: PointValue): number => Math.hypot(first.x - second.x, first.y - second.y);

const anchorPoint = (label: Locator): Promise<PointValue> => label.evaluate((element) => {
  const { bottom, width, x } = element.getBoundingClientRect();
  return { x: x + width / 2, y: bottom };
});

test.use({ hasTouch: true, viewport: DESKTOP_VIEWPORT });

for (const motion of ['no-preference', 'reduce'] as const) {
  test(`follows the forklift to its assigned charger with motion preference ${motion}`, async ({ context, page }, testInfo) => {
    test.setTimeout(120_000);
    const control = await context.newPage();
    const driver = await createEngineWorkerRobot(control, DRIVER);
    const { method } = WarehouseReceivingService;
    try {
      const { tasks } = await callYardWorker(driver, method.listReceivingTasks, SCOPE);
      const task = tasks.find(receipt => receipt.expectedUnits.some(unit => unit.sscc === SSCC));
      if (task === undefined) {
        throw new Error('The forklift operator needs the seeded receiving task');
      }
      const scope = { ...SCOPE, taskId: task.id };
      const claim = await callYardWorker(driver, method.claimReceivingTask, {
        ...scope, expectedVersion: task.version, idempotencyKey: randomUUID(),
      });
      if (claim.task === undefined) {
        throw new Error('The operator must claim the receipt before unloading');
      }
      const received = await callYardWorker(driver, method.receiveHandlingUnit, {
        ...scope, expectedVersion: claim.task.version, idempotencyKey: randomUUID(), unit: { case: 'sscc', value: SSCC },
      });
      const fleet = await callYardWorker(driver, WarehouseEquipmentService.method.getWarehouseEquipment, SCOPE);
      const unit = fleet.equipment.find(candidate => candidate.taskId === task.id);
      const [station] = fleet.stations;
      if (received.task === undefined || unit === undefined || station === undefined) {
        throw new Error('The received pallet needs a working forklift and a charging station');
      }
      expect(unit.status).toBe(WarehouseEquipmentStatus.HANDLING);
      expect(unit.batteryPercent).toBeLessThan(20);

      await page.emulateMedia({ reducedMotion: motion });
      await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
      const scene = createSceneRobot(page);
      scene.watchPageErrors();
      await createPersonaRobot(page).openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
      await createAssistantRobot(page).dismissReplica('digest');
      await page.bringToFront();
      await scene.chooseGraphicsPreference('low');
      await scene.expectSceneState('ready');
      const toggle = page.getByTestId('warehouse-scene-view-toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      const marker = page.getByTestId(`warehouse-scene-equipment-${unit.id}`);
      const charger = page.getByTestId(`warehouse-scene-station-${station.id}`);
      await expect(marker).toBeVisible();
      await expect(charger).toBeVisible();
      await expect(charger).not.toHaveAttribute('data-equipment-id', /.+/u);
      await freezeEngineClock(page, control);
      await scene.waitForIdle();
      const start = await anchorPoint(marker);
      const track = await marker.evaluateHandle((element) => {
        if (!(element instanceof HTMLButtonElement) || element.style.transform === '') {
          throw new Error('The working forklift must be projected before the receipt finishes');
        }
        const points: PointValue[] = [];
        const recordProjection = (): void => {
          const matrix = new DOMMatrixReadOnly(element.style.transform);
          const previous = points.at(-1);
          if (previous?.x !== matrix.e || previous.y !== matrix.f) {
            points.push({ x: matrix.e, y: matrix.f });
          }
        };
        recordProjection();
        const observer = new MutationObserver(recordProjection);
        observer.observe(element, { attributeFilter: ['style'] });
        return { observer, points };
      });
      await callYardWorker(driver, method.finishReceivingTask, {
        ...scope, expectedVersion: received.task.version, idempotencyKey: randomUUID(),
      });
      await expect(charger).toHaveAttribute('data-equipment-id', unit.id);
      await scene.waitForIdle();
      await scene.expectNoDrawFramesFor(700);
      const end = await anchorPoint(marker);
      const stationPoint = await anchorPoint(charger);
      expect(distance(start, end)).toBeGreaterThan(4);
      expect(distance(end, stationPoint)).toBeLessThan(distance(start, stationPoint));
      const path = await track.evaluate(({ observer, points }) => {
        observer.disconnect();
        return points;
      });
      await track.dispose();
      await testInfo.attach('forklift-projected-positions', { body: JSON.stringify(path), contentType: 'application/json' });
      const origin = path[0];
      const destination = path.at(-1);
      if (origin === undefined || destination === undefined) {
        throw new Error('The forklift needs a projected start and destination');
      }
      const travel = distance(origin, destination);
      expect(travel).toBeGreaterThan(4);
      if (motion === 'reduce') {
        expect(path).toEqual([origin, destination]);
      }
      else {
        const tolerance = Math.max(2, travel * 0.12);
        const hasIntermediatePosition = path.some(point => distance(origin, point) > tolerance && distance(destination, point) > tolerance);
        expect(hasIntermediatePosition).toBe(true);
      }
      await page.screenshot({ path: testInfo.outputPath('warehouse-forklift-charging.png') });

      await marker.tap();
      const inspector = page.getByTestId('warehouse-equipment-inspector');
      await expect(inspector).toContainText(unit.code);
      await expect(inspector.getByTestId('warehouse-equipment-inspector-station')).toHaveAttribute('data-station-id', station.id);
      const card = await inspector.innerText();
      await page.keyboard.press('Escape');
      await expect(marker).toBeFocused();
      await toggle.click();
      await createWarehouseRobot(page).openEquipmentTab();
      const row = page.getByTestId(`warehouse-equipment-open-${unit.id}`);
      await row.focus();
      await row.press('Enter');
      await expect(inspector).toHaveText(card, { useInnerText: true });
      await page.keyboard.press('Escape');
      await expect(row).toBeFocused();

      if (motion === 'reduce') {
        await page.reload();
        await scene.expectSceneState('ready');
        await toggle.click();
        await expect(charger).toHaveAttribute('data-equipment-id', unit.id);
        await expect(marker).toBeVisible();
        await scene.waitForIdle();
        expect(distance(await anchorPoint(marker), end)).toBeLessThan(2);
        await scene.expectNoDrawFramesFor(700);
      }
      expect(scene.readPageErrors()).toEqual([]);
    }
    finally {
      await driver.stop();
    }
  });
}
