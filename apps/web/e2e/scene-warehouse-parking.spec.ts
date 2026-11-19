import type {
  DescMessage,
  DescMethodUnary,
  MessageInitShape,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  Locator,
  Page,
  TestInfo,
} from '@playwright/test';
import type { ListReceivingTasksResponse } from '@skladburg/contracts/wms/v1/receiving';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import type {
  ScaledDockFixtureValue,
  ScaledDockScenarioValue,
} from './fixtures/sixDockWarehouse.ts';
import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';
import type { SceneRobotValue } from './robots/scene-robot.ts';
import type { TruckCabPositionValue } from './robots/warehouse-cab-observer.ts';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { freezeEngineClock } from './fixtures/engineClock.ts';
import {
  toObjectHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import { storeScaledDockWarehouse } from './fixtures/sixDockWarehouse.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import {
  readTruckCabPositions,
  watchDockHandoff,
} from './robots/warehouse-cab-observer.ts';
import { scanDeliveredPallet } from './robots/warehouse-trip-handoff-robot.ts';

const SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };
const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(SCOPE.warehouseId));
const REST_PERIOD_MS = 700;
const OVERVIEW_STYLE = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }';
const SCENE_CHUNK = /\/assets\/(?:SceneRoot|WarehouseWorldScene|qualityLevel)-[^/]+\.js$/u;
const POSITION_TOLERANCE_PX = 7;
const PARKING_TRANSITION_TIMEOUT_MS = 70_000;
const FLEET_CASES = [20, 25, 30, 'capacity'] as const;
const COTTAGE_SSCC = '000000000000000017';
const NEXT_VISIT_ADVANCE_MS = 5 * 60 * 60_000;

const YARD_DRAW_COUNTER_SCRIPT = DRAW_COUNTER_INIT_SCRIPT
  .replace('counter.triangles = 0;', 'const beforeFrame = counter.count - 1; counter.triangles = 0;')
  .replace('counter.isInFrame = false;', 'counter.lastFrameDrawCalls = counter.count - beforeFrame; counter.isInFrame = false;');

interface SettlingYardValue {
  anchors: readonly TruckCabPositionValue[];
  canvas: Locator;
  exitBeyondDepth?: number | undefined;
  label: string;
  motionAnchors?: readonly TruckCabPositionValue[] | undefined;
  page: Page;
  scene: SceneRobotValue;
  testInfo: TestInfo;
}

interface YardAnchorsValue {
  docks: ReadonlyMap<number, TruckCabPositionValue>;
  slots: readonly TruckCabPositionValue[];
}

const call = async <TInput extends DescMessage, TOutput extends DescMessage>(
  worker: EngineWorkerRobotValue,
  method: DescMethodUnary<TInput, TOutput>,
  request: MessageInitShape<TInput>,
): Promise<MessageShape<TOutput>> => {
  const body = toBinary(method.input, create(method.input, request));
  return fromBinary(method.output, await worker.call(`${method.parent.typeName}/${method.name}`, body));
};

const prepareFixture = async (page: Page, scenario: ScaledDockScenarioValue): Promise<ScaledDockFixtureValue> => {
  const seed = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  const [{ tasks }, { topology }, { warehouses }] = await Promise.all([
    call(seed, WarehouseReceivingService.method.listReceivingTasks, SCOPE),
    call(seed, WarehouseTopologyService.method.getWarehouseTopology, SCOPE),
    call(seed, OrganizationService.method.listWarehouses, {}),
  ]);
  const warehouse = warehouses.find(entry => entry.id === SCOPE.warehouseId);
  if (warehouse === undefined || topology === undefined) {
    throw new Error('The seed has no Kazan warehouse');
  }
  const deliveries = await Promise.all(tasks.map(async (task) => {
    const { deal } = await call(seed, DealService.method.getDeal, { dealId: task.dealId });
    if (deal === undefined) {
      throw new Error(`Missing the seeded receipt deal ${task.dealId}`);
    }
    return { deal, task };
  }));
  await seed.stop();
  return storeScaledDockWarehouse(page, topology, warehouse, deliveries, scenario);
};

const projectDepth = ({ x, y }: TruckCabPositionValue): number => y * Math.sqrt(3) - x;
const projectLane = ({ x, y }: TruckCabPositionValue): number => y * Math.sqrt(3) + x;
const fromFront = (first: TruckCabPositionValue, second: TruckCabPositionValue): number => projectDepth(second) - projectDepth(first);

const hasCabAt = (cabs: readonly TruckCabPositionValue[], anchor: TruckCabPositionValue): boolean =>
  cabs.some(({ x, y }) => Math.hypot(x - anchor.x, y - anchor.y) <= POSITION_TOLERANCE_PX);

const readYardAnchors = (cabs: readonly TruckCabPositionValue[], knownDockNumbers: readonly number[]): YardAnchorsValue => {
  const ordered = cabs.toSorted(fromFront);
  const dockCabs = ordered.slice(0, knownDockNumbers.length).toSorted((first, second) => first.x - second.x);
  const docks = new Map(dockCabs.map((cab, index) => [knownDockNumbers[index] ?? 0, cab]));
  const parked = ordered.slice(knownDockNumbers.length);
  const lanes = parked.map(projectLane);
  const midpoint = (Math.min(...lanes) + Math.max(...lanes)) / 2;
  const main = parked.filter(cab => projectLane(cab) > midpoint);
  const opposite = parked.filter(cab => projectLane(cab) <= midpoint);
  expect(main.length - opposite.length).toBeGreaterThanOrEqual(0);
  expect(main.length - opposite.length).toBeLessThanOrEqual(1);
  const slots = [...main.slice(0, 3), ...opposite.slice(0, 3)];
  for (const [index, cab] of main.slice(3).entries()) {
    slots.push(cab);
    const facing = opposite[index + 3];
    if (facing !== undefined) {
      slots.push(facing);
    }
  }
  return { docks, slots };
};

const readCabs = (page: Page, screenshot: Buffer): Promise<TruckCabPositionValue[]> =>
  readTruckCabPositions(page, screenshot, 16);

const readStableFrame = async (canvas: Locator, scene: SceneRobotValue, path: string): Promise<Buffer> => {
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  return canvas.screenshot({ path, style: OVERVIEW_STYLE });
};

const settleAndMeasure = async ({
  anchors, canvas, exitBeyondDepth, label, motionAnchors = anchors, page, scene, testInfo,
}: SettlingYardValue): Promise<void> => {
  let maxUnmatched = 0;
  let sawTruckCrossOuterParkingDepth = exitBeyondDepth === undefined;
  await expect.poll(async () => {
    const frame = await canvas.screenshot({ style: OVERVIEW_STYLE });
    const cabs = await readCabs(page, frame);
    const unmatched = cabs.filter(cab => !hasCabAt(motionAnchors, cab));
    maxUnmatched = Math.max(maxUnmatched, unmatched.length);
    sawTruckCrossOuterParkingDepth ||= exitBeyondDepth !== undefined && unmatched.some(cab => projectDepth(cab) < exitBeyondDepth);
    return { count: cabs.length, positionsMatch: anchors.every(anchor => hasCabAt(cabs, anchor)), sawTruckCrossOuterParkingDepth };
  }, { intervals: [250], message: `parking positions after ${label}`, timeout: PARKING_TRANSITION_TIMEOUT_MS }).toEqual({
    count: anchors.length, positionsMatch: true, sawTruckCrossOuterParkingDepth: true,
  });
  expect(maxUnmatched).toBeLessThanOrEqual(1);
  await readStableFrame(canvas, scene, testInfo.outputPath(`${label}.png`));
};

const readLastFrameDrawCalls = (page: Page): Promise<number> =>
  page.evaluate<number>('window.__drawCounter?.lastFrameDrawCalls ?? 0');

const attachYardMetrics = async (scene: SceneRobotValue, page: Page, testInfo: TestInfo, phase: string): Promise<void> => {
  const [drawCalls, triangles, longTasksDuringMotion] = await Promise.all([
    readLastFrameDrawCalls(page), scene.readTriangles(), scene.readLongTaskDurations(),
  ]);
  expect(drawCalls).toBeGreaterThan(0);
  expect(triangles).toBeGreaterThan(0);
  const path = testInfo.outputPath(`yard-metrics-${phase}.json`);
  await writeFile(path, JSON.stringify({ drawCalls, longTasksDuringMotion, triangles }));
  await testInfo.attach(`yard-metrics-${phase}`, { contentType: 'application/json', path });
};

const recordMovingFrame = async ({ anchors, canvas, label, page, scene, testInfo }: SettlingYardValue): Promise<void> => {
  await expect.poll(async () => {
    const frame = await canvas.screenshot({ style: OVERVIEW_STYLE });
    const cabs = await readCabs(page, frame);
    const isCabOnRoute = cabs.some(cab => !hasCabAt(anchors, cab));
    if (isCabOnRoute) {
      await Promise.all([
        attachYardMetrics(scene, page, testInfo, 'moving'),
        writeFile(testInfo.outputPath(`${label}.png`), frame),
      ]);
    }
    return isCabOnRoute;
  }, { message: 'at least one cab must be visible outside the stationary positions' }).toBe(true);
};

const claimReceipt = async (worker: EngineWorkerRobotValue, taskId: string, version: number): Promise<number> => {
  const { task } = await call(worker, WarehouseReceivingService.method.claimReceivingTask, {
    ...SCOPE, expectedVersion: version, idempotencyKey: randomUUID(), taskId,
  });
  if (task?.status !== ReceivingTaskStatus.IN_PROGRESS) {
    throw new Error(`Could not claim the receipt ${taskId}`);
  }
  return task.version;
};

const finishReceipt = async (worker: EngineWorkerRobotValue, taskId: string, version: number): Promise<void> => {
  const { task } = await call(worker, WarehouseReceivingService.method.finishReceivingTask, {
    ...SCOPE, expectedVersion: version, idempotencyKey: randomUUID(), taskId,
  });
  expect(task?.status).toBe(ReceivingTaskStatus.READY_FOR_RECONCILIATION);
};

test.use({ viewport: DESKTOP_VIEWPORT });

for (const scenario of FLEET_CASES) {
  test(`runs the warehouse yard with ${scenario === 'capacity' ? 'all 30 parking places occupied' : `${String(scenario)} trucks`}`,
    async ({ context, page }, testInfo) => {
      test.setTimeout(180_000);
      const seedPage = await context.newPage();
      const fixture = await prepareFixture(seedPage, scenario);
      await seedPage.close();
      const activeCount = scenario === 'capacity' ? 30 : scenario;
      const sceneRequests: string[] = [];
      page.on('request', (request) => {
        if (SCENE_CHUNK.test(new URL(request.url()).pathname)) {
          sceneRequests.push(request.url());
        }
      });
      await page.addInitScript({ content: YARD_DRAW_COUNTER_SCRIPT });
      await page.addInitScript({ content: createStoreSystemThemeScript() });
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      const scene = createSceneRobot(page);
      scene.watchPageErrors();
      await createPersonaRobot(page).openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
      const receipts = page.getByTestId('warehouse-receiving-task');
      const taskCard = (taskId: string): Locator => receipts.filter({ has: page.locator(`a[href="#/deals/${taskId}"]`) });
      const dockCode = (taskId: string): Locator => taskCard(taskId).getByTestId('warehouse-receiving-dock');
      await expect(receipts).toHaveCount(activeCount);
      await scene.expectNoCanvas();
      expect(sceneRequests).toEqual([]);
      expect(await scene.readDrawFrames()).toBe(0);
      await scene.chooseGraphicsPreference('low');
      await scene.expectSceneState('ready');
      await scene.waitForCameraControls();
      await scene.pressCameraButton('home');

      const workerPage = await context.newPage();
      const worker = await createEngineWorkerRobot(workerPage, DEAL_CUSTOMER);
      try {
        await page.bringToFront();
        const readReceipts = (): Promise<ListReceivingTasksResponse> =>
          call(worker, WarehouseReceivingService.method.listReceivingTasks, { ...SCOPE, page: { pageSize: 100 } });
        const { tasks: initialTasks } = await readReceipts();
        expect(initialTasks.filter(task => task.unloadingPointId === undefined).map(task => task.id)).toEqual(fixture.waitingIds);
        const { neighborId } = fixture;
        if (neighborId !== undefined) {
          const neighbor = taskCard(neighborId);
          const scan = await scanDeliveredPallet(neighbor, COTTAGE_SSCC);
          await scan.click();
          await expect(neighbor.getByTestId('warehouse-placement')).toBeVisible();
          await expect(dockCode(neighborId)).toContainText('D05');
        }
        const canvas = page.getByTestId('scene-viewport').locator('canvas');
        const overview = await readStableFrame(canvas, scene, testInfo.outputPath(`yard-${String(scenario)}-overview.png`));
        const initialCabs = await readCabs(page, overview);
        expect(initialCabs).toHaveLength(activeCount);
        await attachYardMetrics(scene, page, testInfo, 'overview');
        const knownDockNumbers = scenario === 'capacity' ? [] : scenario === 30 ? [4, 5, 6] : [5, 6];
        const { docks, slots } = readYardAnchors(initialCabs, knownDockNumbers);
        expect(slots).toHaveLength(fixture.waitingIds.length);

        if (scenario === 'capacity') {
          await page.setViewportSize({ height: 844, width: 390 });
          await page.reload();
          await scene.expectSceneState('ready');
          const mapOnly = page.getByTestId('top-bar-panels-toggle');
          await mapOnly.click();
          await expect(mapOnly).toHaveAttribute('aria-pressed', 'true');
          const narrow = await readStableFrame(canvas, scene, testInfo.outputPath('yard-30-parking-narrow-reduced.png'));
          expect(await readTruckCabPositions(page, narrow, 5)).toHaveLength(30);
          expect((await readReceipts()).tasks.map(task => task.id)).toEqual(fixture.waitingIds);
          expect(scene.readPageErrors()).toEqual([]);
          return;
        }

        const advanceClock = scenario === 20 ? await freezeEngineClock(page, workerPage) : undefined;
        const [first, second] = fixture.assignments;
        const d04 = docks.get(4);
        const d06 = docks.get(6);
        const sourceB = second === undefined ? undefined : slots[second.parkingIndex];
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await scene.waitForIdle();
        const watch = d04 !== undefined && d06 !== undefined && sourceB !== undefined
          ? await watchDockHandoff(canvas, d04, d06, sourceB)
          : undefined;
        const claimed = await Promise.all(fixture.assignments.map(async ({ releaseTaskId }) => {
          const task = initialTasks.find(candidate => candidate.id === releaseTaskId);
          if (task === undefined) {
            throw new Error(`Missing seeded dock blocker ${releaseTaskId}`);
          }
          return { releaseTaskId, version: await claimReceipt(worker, releaseTaskId, task.version) };
        }));
        const beforeMotion = await scene.readDrawFrames();
        await scene.markMotionStart();
        await Promise.all(claimed.map(({ releaseTaskId, version }) => finishReceipt(worker, releaseTaskId, version)));
        for (const { dockNumber, taskId } of fixture.assignments) {
          await expect(dockCode(taskId)).toContainText(`D0${String(dockNumber)}`);
        }
        const moved = new Set(fixture.assignments.map(assignment => assignment.parkingIndex));
        const remaining = [...docks.values(), ...slots.filter((_cab, index) => !moved.has(index))];
        await scene.waitForDrawFramesToExceed(beforeMotion + 8, 'the warehouse yard did not animate');
        await recordMovingFrame({ anchors: initialCabs, canvas, label: `yard-${String(scenario)}-motion`, page, scene, testInfo });
        await settleAndMeasure({
          anchors: remaining, canvas, label: `yard-${String(scenario)}-assigned`, motionAnchors: initialCabs, page, scene, testInfo,
        });
        if (watch !== undefined) {
          const frame = await watch.evaluate((observation) => {
            observation.stop();
            return observation.frame;
          });
          await watch.dispose();
          expect(frame).toMatch(/^data:image\/png;base64,/u);
          await testInfo.attach('first docked while second stayed in its initial slot', {
            body: Buffer.from(frame?.slice('data:image/png;base64,'.length) ?? '', 'base64'), contentType: 'image/png',
          });
        }
        const { tasks: assigned } = await readReceipts();
        for (const { dockId, taskId } of fixture.assignments) {
          expect(assigned.find(task => task.id === taskId)?.unloadingPointId).toBe(dockId);
        }
        await attachYardMetrics(scene, page, testInfo, 'after-assignments');

        if (scenario === 20 && fixture.nextArrivalId !== undefined && advanceClock !== undefined) {
          const started = await scene.readDrawFrames();
          await advanceClock(NEXT_VISIT_ADVANCE_MS);
          await expect(taskCard(fixture.nextArrivalId)).toBeVisible();
          await scene.waitForDrawFramesToExceed(started + 3, 'the new visit did not turn into the vacant place');
          await settleAndMeasure({ anchors: initialCabs, canvas, label: 'yard-20-refilled', page, scene, testInfo });
          const arrived = (await readReceipts()).tasks.find(task => task.id === fixture.nextArrivalId);
          expect(arrived?.status).toBe(ReceivingTaskStatus.OPEN);
          expect(arrived?.unloadingPointId).toBeUndefined();
        }
        if (scenario === 25 && first !== undefined && d06 !== undefined) {
          const arriving = assigned.find(task => task.id === first.taskId);
          if (arriving === undefined) {
            throw new Error('The refrigerated visit is missing from WMS');
          }
          const version = await claimReceipt(worker, arriving.id, arriving.version);
          const started = await scene.readDrawFrames();
          await finishReceipt(worker, arriving.id, version);
          await scene.waitForDrawFramesToExceed(started + 8, 'the released truck did not drive out');
          const afterDeparture = remaining.filter(anchor => anchor !== d06);
          await settleAndMeasure({
            anchors: afterDeparture,
            canvas,
            exitBeyondDepth: Math.min(...slots.map(projectDepth)),
            label: 'yard-25-exit',
            page,
            scene,
            testInfo,
          });
          expect((await readReceipts()).tasks.find(task => task.id === neighborId)?.unloadingPointId).toBe(fixture.dockIds[4]);
        }
        expect(scene.readPageErrors()).toEqual([]);
      }
      finally {
        await worker.stop();
        await workerPage.close();
      }
    });
}
