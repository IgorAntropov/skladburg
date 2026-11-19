import type {
  CDPSession,
  Locator,
  Page,
} from '@playwright/test';
import type { YardDispatchEntry } from '@skladburg/contracts/wms/v1/receiving';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  WarehouseReceivingService,
  YardDispatchAction,
  YardDispatchOutcome,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';

import type { YardSceneDispatchFixtureValue } from './fixtures/sixDockWarehouse.ts';
import type { TruckCabPositionValue } from './robots/warehouse-cab-observer.ts';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceScript } from './fixtures/graphicsPreference.ts';
import {
  toObjectHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import { storeYardSceneDispatchQueue } from './fixtures/sixDockWarehouse.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import { readTruckCabPositions } from './robots/warehouse-cab-observer.ts';

const SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };
const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(SCOPE.warehouseId));
const REST_PERIOD_MS = 700;
const POSITION_TOLERANCE = 7;
const DOCK_CAB_TOLERANCE = 30;
const REASON = 'Освободился холодный док';
const CANVAS_ONLY_STYLE = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }';
const DISPATCH_VIEWPORT = { height: 900, width: 1920 } as const;
const CAMERA_GESTURE = { x: 1_070, y: 850 } as const;

const requireValue = <T>(value: null | T | undefined, label: string): T => {
  if (value == null) {
    throw new Error(`Could not locate ${label}`);
  }
  return value;
};

const prepareFixture = async (page: Page): Promise<YardSceneDispatchFixtureValue> => {
  const seed = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  const { deliveries, topology, warehouse } = await (async () => {
    const [{ tasks }, { topology }, { warehouses }] = await Promise.all([
      callYardWorker(seed, WarehouseReceivingService.method.listReceivingTasks, SCOPE),
      callYardWorker(seed, WarehouseTopologyService.method.getWarehouseTopology, SCOPE),
      callYardWorker(seed, OrganizationService.method.listWarehouses, {}),
    ]);
    const warehouse = requireValue(warehouses.find(entry => entry.id === SCOPE.warehouseId), 'the Kazan warehouse');
    const deliveries = await Promise.all(tasks.map(async (task) => {
      const { deal } = await callYardWorker(seed, DealService.method.getDeal, { dealId: task.dealId });
      return { deal: requireValue(deal, `the source deal ${task.dealId}`), task };
    }));
    return { deliveries, topology: requireValue(topology, 'the Kazan topology'), warehouse };
  })().finally(seed.stop);
  return storeYardSceneDispatchQueue(page, topology, warehouse, deliveries);
};

const openYard = async (page: Page): Promise<void> => {
  await createPersonaRobot(page).openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await page.getByTestId('warehouse-workspace').locator('button[id$="-trigger-yard"]').click();
  await expect(page.getByTestId('warehouse-yard-dispatch')).toBeVisible();
};

const readCabs = async (page: Page, canvas: Locator): Promise<TruckCabPositionValue[]> => {
  const screenshot = await canvas.screenshot({ scale: 'css', style: CANVAS_ONLY_STYLE });
  return readTruckCabPositions(page, screenshot, 16);
};

const projectDepth = ({ x, y }: TruckCabPositionValue): number => y * Math.sqrt(3) - x;
const projectLane = ({ x, y }: TruckCabPositionValue): number => y * Math.sqrt(3) + x;

const readFirstParkingCab = (cabs: readonly TruckCabPositionValue[]): TruckCabPositionValue => {
  const lanes = cabs.map(projectLane);
  const midpoint = (Math.min(...lanes) + Math.max(...lanes)) / 2;
  const main = cabs.filter(cab => projectLane(cab) > midpoint);
  return requireValue(main.toSorted((current, prev) => projectDepth(prev) - projectDepth(current))[0], 'the first truck in the main row');
};

const readCenter = async (locator: Locator): Promise<TruckCabPositionValue> => {
  const box = requireValue(await locator.boundingBox(), 'a visible dock target');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const moveTouch = async (touch: CDPSession, from: TruckCabPositionValue, to: TruckCabPositionValue): Promise<void> => {
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    const part = step / steps;
    await touch.send('Input.dispatchTouchEvent', {
      touchPoints: [{ x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part }], type: 'touchMove',
    });
  }
};

const hasCabAt = (cabs: readonly TruckCabPositionValue[], anchor: TruckCabPositionValue): boolean =>
  cabs.some(cab => Math.hypot(cab.x - anchor.x, cab.y - anchor.y) <= POSITION_TOLERANCE);

const canPointAtCanvas = (canvas: Locator, point: TruckCabPositionValue): Promise<boolean> =>
  canvas.evaluate((element, { x, y }) => document.elementFromPoint(x, y) === element, point);

const panYard = async (page: Page, canvas: Locator, offsetX: number): Promise<void> => {
  const { x, y } = CAMERA_GESTURE;
  await expect.poll(() => canPointAtCanvas(canvas, CAMERA_GESTURE), {
    message: 'a free part of the yard accepts the camera drag',
  }).toBe(true);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + offsetX, y, { steps: 10 });
  await page.mouse.up();
};

test.use({ hasTouch: true, viewport: DISPATCH_VIEWPORT });

test('drags the eligible truck to dock six, confirms in HUD and settles without idle frames', async ({ context, page }, testInfo) => {
  test.setTimeout(120_000);
  const controlPage = await context.newPage();
  const fixture = await prepareFixture(controlPage);
  const worker = await createEngineWorkerRobot(controlPage, DEAL_CUSTOMER);
  const colleague = await context.newPage();
  await colleague.addInitScript({ content: createStoreGraphicsPreferenceScript('off') });
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  const canvas = page.getByTestId('scene-viewport').locator('canvas');
  const targets = page.getByTestId('warehouse-yard-dock-target');
  const dockTarget = targets.and(page.locator(`[data-dock-id="${fixture.dockId}"]`));
  const form = page.getByTestId('yard-dispatch-form');
  const visit = (tab: Page): Locator => tab.getByTestId('yard-dispatch-visit').and(tab.locator(`[data-task-id="${fixture.taskId}"]`));
  const readJournal = async (): Promise<YardDispatchEntry[]> =>
    (await callYardWorker(worker, WarehouseReceivingService.method.listYardDispatchEntries, SCOPE)).entries;

  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await openYard(colleague);
    await openYard(page);
    await page.bringToFront();
    await expect(page.getByTestId('yard-dispatch-visit')).toHaveCount(fixture.visitCount);
    await expect(visit(page)).toHaveAttribute('data-yard-state', 'queue');
    await expect(visit(colleague)).toHaveAttribute('data-yard-state', 'queue');
    await scene.chooseGraphicsPreference('low');
    await scene.expectOneCanvas();
    await scene.waitForCameraControls();
    await scene.pressCameraButton('home');
    await scene.waitForIdle();
    await panYard(page, canvas, 350);
    await scene.waitForIdle();
    await panYard(page, canvas, 350);
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

    const readSource = async (cabs: readonly TruckCabPositionValue[]): Promise<TruckCabPositionValue> => {
      const box = requireValue(await canvas.boundingBox(), 'the warehouse canvas');
      const parking = readFirstParkingCab(cabs);
      return { x: box.x + parking.x, y: box.y + parking.y };
    };
    const initial = await readCabs(page, canvas);
    expect(initial).toHaveLength(fixture.visitCount);
    let source = await readSource(initial);
    await expect.poll(() => canPointAtCanvas(canvas, source), { message: 'the first truck is outside the HUD surface' }).toBe(true);
    await page.mouse.move(source.x, source.y);
    await page.mouse.down();
    await expect(targets).toHaveCount(1);
    await expect(dockTarget).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(targets).toHaveCount(0);
    await expect(form).toHaveCount(0);
    expect(await readJournal()).toEqual([]);

    const beforeCamera = await scene.readDrawFrames();
    await panYard(page, canvas, -30);
    await scene.waitForDrawFramesToExceed(beforeCamera, 'camera remains available after cancelling the drag');
    await scene.waitForIdle();
    const parked = await readCabs(page, canvas);
    expect(parked).toHaveLength(fixture.visitCount);
    source = await readSource(parked);

    await page.mouse.move(source.x, source.y);
    await page.mouse.down();
    await expect(dockTarget).toBeVisible();
    await page.mouse.move(source.x + 18, source.y, { steps: 4 });
    await page.mouse.move(source.x, source.y, { steps: 4 });
    await page.mouse.up();
    await expect(targets).toHaveCount(0);
    await expect(form).toHaveCount(0);
    expect(await readJournal()).toEqual([]);

    await page.mouse.down();
    await expect(dockTarget).toBeVisible();
    const mouseDock = await readCenter(dockTarget);
    expect(await canPointAtCanvas(canvas, mouseDock)).toBe(true);
    await page.mouse.move(mouseDock.x, mouseDock.y, { steps: 8 });
    await expect(dockTarget).toHaveAttribute('data-hovered', 'true');
    await page.mouse.up();
    await expect(form.getByTestId('yard-dispatch-dock').locator('select')).toHaveValue(fixture.dockId);
    expect(await readJournal()).toEqual([]);
    await form.getByTestId('yard-dispatch-cancel').click();
    await expect(form).toHaveCount(0);

    const touch = await context.newCDPSession(page);
    try {
      await touch.send('Input.dispatchTouchEvent', { touchPoints: [source], type: 'touchStart' });
      await expect(dockTarget).toBeVisible();
      const touchDock = await readCenter(dockTarget);
      await moveTouch(touch, source, touchDock);
      await expect(dockTarget).toHaveAttribute('data-hovered', 'true');
      await touch.send('Input.dispatchTouchEvent', { touchPoints: [], type: 'touchEnd' });
    }
    finally {
      await touch.detach();
    }
    await expect(form.getByTestId('yard-dispatch-dock').locator('select')).toHaveValue(fixture.dockId);
    await expect(visit(page)).toHaveAttribute('data-yard-state', 'queue');
    await expect(visit(colleague)).toHaveAttribute('data-yard-state', 'queue');
    expect(await readJournal()).toEqual([]);

    await form.getByTestId('yard-dispatch-reason').locator('input').fill(REASON);
    await form.getByTestId('yard-dispatch-submit').click();
    const routePoints: TruckCabPositionValue[] = [];
    await expect.poll(async () => {
      for (const cab of await readCabs(page, canvas)) {
        if (!hasCabAt(parked, cab) && !hasCabAt(routePoints, cab)) {
          routePoints.push(cab);
        }
      }
      return routePoints.length;
    }, { intervals: [200], message: 'the truck crosses more than one position outside the original parking rows' }).toBeGreaterThan(1);
    await expect(visit(colleague)).toHaveAttribute('data-yard-state', 'assigned');
    await expect(visit(colleague)).toContainText('D06');
    await expect.poll(readJournal).toMatchObject([{
      action: YardDispatchAction.ASSIGN_DOCK,
      after: { unloadingPointId: fixture.dockId },
      outcome: YardDispatchOutcome.DOCK_ASSIGNED,
      reason: REASON,
      taskId: fixture.taskId,
    }]);
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
    const finalCabs = await readCabs(page, canvas);
    expect(finalCabs).toHaveLength(fixture.visitCount);
    expect(hasCabAt(finalCabs, readFirstParkingCab(parked))).toBe(false);
    const arrivedCabs = finalCabs.filter(cab => !hasCabAt(parked, cab));
    expect(arrivedCabs).toHaveLength(1);
    const cab = requireValue(arrivedCabs[0], 'the cab at dock D06');
    const box = requireValue(await canvas.boundingBox(), 'the warehouse canvas');
    expect(Math.hypot(box.x + cab.x - mouseDock.x, box.y + cab.y - mouseDock.y)).toBeLessThanOrEqual(DOCK_CAB_TOLERANCE);
    await canvas.screenshot({ path: testInfo.outputPath('yard-dispatch-d06.png'), style: CANVAS_ONLY_STYLE });
    expect(scene.readPageErrors()).toEqual([]);
  }
  finally {
    await worker.stop();
  }
});
