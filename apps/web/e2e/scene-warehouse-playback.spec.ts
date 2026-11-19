import type {
  DescMessage,
  DescMethodUnary,
  MessageInitShape,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  BrowserContext,
  JSHandle,
  Locator,
  Page,
  TestInfo,
} from '@playwright/test';
import type {
  FinishReceivingTaskRequest,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';

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

import type { SixDockFixtureValue } from './fixtures/sixDockWarehouse.ts';
import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';
import type { SceneRobotValue } from './robots/scene-robot.ts';
import type { TruckCabPositionValue } from './robots/warehouse-cab-observer.ts';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import { withNativeTabVisibility } from './fixtures/nativeTabVisibility.ts';
import {
  toObjectHash,
  toSectionHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import { storeSixDockWarehouse } from './fixtures/sixDockWarehouse.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import {
  readTruckCabPositions,
  watchDockHandoff,
} from './robots/warehouse-cab-observer.ts';

const SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };
const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(SCOPE.warehouseId));
const COTTAGE_SSCC = '000000000000000017';
const REST_MS = 700;
const POSITION_TOLERANCE_PX = 10;
const YARD_TRANSITION_MS = 60_000;
const CANVAS_STYLE = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }';
const { method } = WarehouseReceivingService;

interface PlaybackWarehouseValue {
  cellId: string;
  fixture: SixDockFixtureValue;
  page: Page;
  readTasks: () => Promise<ReceivingTask[]>;
  worker: EngineWorkerRobotValue;
}

type ReceiptCommandValue = Pick<FinishReceivingTaskRequest, 'expectedVersion' | 'idempotencyKey' | 'taskId' | 'warehouseId'>;

interface YardFrameCaptureValue {
  after: string | undefined;
  before: string | undefined;
  stop: () => void;
}

interface YardValue {
  canvas: Locator;
  page: Page;
  scene: SceneRobotValue;
}

const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`Missing ${label}`);
  }
  return value;
};

const call = async <TInput extends DescMessage, TOutput extends DescMessage>(
  worker: EngineWorkerRobotValue,
  rpc: DescMethodUnary<TInput, TOutput>,
  request: MessageInitShape<TInput>,
): Promise<MessageShape<TOutput>> => {
  const body = toBinary(rpc.input, create(rpc.input, request));
  return fromBinary(rpc.output, await worker.call(`${rpc.parent.typeName}/${rpc.name}`, body));
};

const taskById = (tasks: readonly ReceivingTask[], id: string): ReceivingTask => required(tasks.find(task => task.id === id), id);

const command = ({ id, version }: ReceivingTask): ReceiptCommandValue =>
  ({ ...SCOPE, expectedVersion: version, idempotencyKey: randomUUID(), taskId: id });

const createPlaybackWarehouse = async (context: BrowserContext, baseUrl: string): Promise<PlaybackWarehouseValue> => {
  const page = await context.newPage();
  const seed = await createEngineWorkerRobot(page, DEAL_CUSTOMER, baseUrl);
  const [{ tasks }, response, { warehouses }] = await Promise.all([
    call(seed, method.listReceivingTasks, SCOPE),
    call(seed, WarehouseTopologyService.method.getWarehouseTopology, SCOPE),
    call(seed, OrganizationService.method.listWarehouses, {}),
  ]);
  const topology = required(response.topology, 'seeded Kazan topology');
  const warehouse = required(warehouses.find(entry => entry.id === SCOPE.warehouseId), 'seeded Kazan warehouse');
  const cellId = required(topology.storageZones[0]?.rows[0]?.racks[0]?.tiers[0]?.cells[0]?.id, 'Kazan storage cell');
  const deliveries = await Promise.all(tasks.map(async (task) => {
    const { deal } = await call(seed, DealService.method.getDeal, { dealId: task.dealId });
    return { deal: required(deal, task.dealId), task };
  }));
  await seed.stop();
  const fixture = await storeSixDockWarehouse(page, topology, warehouse, deliveries);
  const worker = await createEngineWorkerRobot(page, DEAL_CUSTOMER, baseUrl);
  const readTasks = async (): Promise<ReceivingTask[]> => (await call(worker, method.listReceivingTasks, SCOPE)).tasks;
  const current = await readTasks();
  await Promise.all([fixture.releaseMiddleId, fixture.releaseFarId, fixture.neighborId].map(async (id): Promise<void> => {
    const { task } = await call(worker, method.claimReceivingTask, command(taskById(current, id)));
    expect(task?.status).toBe(ReceivingTaskStatus.IN_PROGRESS);
  }));

  return { cellId, fixture, page, readTasks, worker };
};

const warehouseUrl = (baseUrl: string): string =>
  new URL(`./${WAREHOUSE_HASH}?as=${PERSONAS.freshCustomer.id}`, baseUrl).href;

const openYard = async (page: Page, baseUrl: string): Promise<YardValue> => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  scene.watchSceneChunkRequests();
  await page.bringToFront();
  await page.goto(warehouseUrl(baseUrl));
  await expect(page.getByTestId('warehouse-receiving-task')).toHaveCount(6);
  await scene.expectNoCanvas();
  expect(scene.countRequestedSceneChunks()).toBe(0);
  await scene.chooseGraphicsPreference('low');
  await scene.expectSceneState('ready');
  await scene.waitForCameraControls();
  await scene.pressCameraButton('home');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_MS);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await scene.waitForIdle();

  return { canvas: page.getByTestId('scene-viewport').locator('canvas'), page, scene };
};

const depth = ({ x, y }: TruckCabPositionValue): number => y * Math.sqrt(3) - x;
const hasCabAt = (cabs: readonly TruckCabPositionValue[], target: TruckCabPositionValue): boolean =>
  cabs.some(cab => Math.hypot(cab.x - target.x, cab.y - target.y) < POSITION_TOLERANCE_PX);

const readFrame = async ({ canvas, page }: YardValue): Promise<{ cabs: TruckCabPositionValue[]; frame: Buffer }> => {
  const frame = await canvas.screenshot({ style: CANVAS_STYLE });
  return { cabs: await readTruckCabPositions(page, frame, 35), frame };
};

const readAnchors = async (yard: YardValue): Promise<{
  dock04: TruckCabPositionValue;
  dock05: TruckCabPositionValue;
  dock06: TruckCabPositionValue;
  front: TruckCabPositionValue;
  middle: TruckCabPositionValue;
  rear: TruckCabPositionValue;
}> => {
  const { cabs } = await readFrame(yard);
  expect(cabs).toHaveLength(6);
  const byDepth = cabs.toSorted((first, second) => depth(first) - depth(second));
  const [rear, middle, front] = byDepth;
  const [dock04, dock05, dock06] = byDepth.slice(3).toSorted((first, second) => first.x - second.x);
  return {
    dock04: required(dock04, 'D04 cab'),
    dock05: required(dock05, 'D05 cab'),
    dock06: required(dock06, 'D06 cab'),
    front: required(front, 'front parking cab'),
    middle: required(middle, 'middle parking cab'),
    rear: required(rear, 'rear parking cab'),
  };
};

const receiptCard = (page: Page, { dealId }: ReceivingTask): Locator =>
  page.getByTestId('warehouse-receiving-task').filter({ has: page.locator(`a[href="#/deals/${dealId}"]`) });

const expectPromotion = async (
  yard: YardValue,
  world: PlaybackWarehouseValue,
  taskId: string,
  dockNumber: number,
): Promise<void> => {
  const task = taskById(await world.readTasks(), taskId);
  expect(task.unloadingPointId).toBe(required(world.fixture.dockIds[dockNumber - 1], `dock ${String(dockNumber)}`));
  await expect(receiptCard(yard.page, task).getByTestId('warehouse-receiving-dock')).toContainText(`D0${String(dockNumber)}`);
};

const finish = async (worker: EngineWorkerRobotValue, current: ReceivingTask): Promise<ReceivingTask> => {
  const { task } = await call(worker, method.finishReceivingTask, command(current));
  expect(task).toMatchObject({
    id: current.id,
    status: ReceivingTaskStatus.READY_FOR_RECONCILIATION,
    unloadingPointId: current.unloadingPointId,
    version: current.version + 1,
  });
  return required(task, current.id);
};

const scanPlaceAndFinish = async (world: PlaybackWarehouseValue, current: ReceivingTask): Promise<void> => {
  const { cellId, worker } = world;
  const scanned = await call(worker, method.receiveHandlingUnit, {
    ...command(current), unit: { case: 'sscc', value: COTTAGE_SSCC },
  });
  const task = required(scanned.task, current.id);
  const unit = required(task.receivedUnits[0]?.balanceAtReceipt?.handlingUnit, 'scanned handling unit');
  expect(unit.sscc).toBe(COTTAGE_SSCC);
  const placed = await call(worker, method.putAwayHandlingUnit, {
    ...command(task), handlingUnitId: unit.id, toCellId: cellId,
  });
  expect(placed.task?.receivedUnits).toMatchObject([{ balanceAtReceipt: { handlingUnit: { id: unit.id } }, putAwayCellId: cellId }]);
  const completed = await finish(worker, required(placed.task, current.id));
  expect(completed.receivedUnits).toEqual(placed.task?.receivedUnits);
};

const expectFleet = async (yard: YardValue, anchors: readonly TruckCabPositionValue[]): Promise<void> => {
  await expect.poll(async () => {
    const { cabs } = await readFrame(yard);
    return cabs.length === anchors.length && anchors.every(anchor => hasCabAt(cabs, anchor));
  }, { message: 'cabs must settle at the confirmed docks and parking places without duplicates', timeout: YARD_TRANSITION_MS }).toBe(true);
  await yard.scene.waitForIdle();
  await yard.scene.expectNoDrawFramesFor(REST_MS);
};

const startDeparture = async (
  yard: YardValue,
  world: PlaybackWarehouseValue,
  dock: TruckCabPositionValue,
): Promise<void> => {
  const current = taskById(await world.readTasks(), world.fixture.releaseMiddleId);
  await finish(world.worker, current);
  await expect.poll(async () => {
    const { cabs } = await readFrame(yard);
    return cabs.length === 6 && !hasCabAt(cabs, dock);
  }, { intervals: [100], message: 'the departure must be visibly in progress before the tab changes', timeout: 15_000 }).toBe(true);
};

const saveTiming = async ({ page, scene }: YardValue, testInfo: TestInfo, label: string): Promise<void> => {
  const [cumulativeFrameCount, longTasksMs, userAgent, wallTimeMs] = await Promise.all([
    scene.readDrawFrames(), scene.readLongTaskDurations(), page.evaluate(() => navigator.userAgent), scene.readWorldSettleMs(),
  ]);
  expect(wallTimeMs).toBeGreaterThan(0);
  const path = testInfo.outputPath(`${label}.json`);
  await writeFile(path, JSON.stringify({ cumulativeFrameCount, longTasksMs, renderer: 'SwiftShader', userAgent, wallTimeMs }));
  await testInfo.attach(label, { contentType: 'application/json', path });
};

const savePng = async (testInfo: TestInfo, label: string, frame: Buffer): Promise<void> => {
  const path = testInfo.outputPath(`${label}.png`);
  await writeFile(path, frame);
  await testInfo.attach(label, { contentType: 'image/png', path });
};

const ensureVisibility = async (page: Page, isHidden: boolean): Promise<void> => {
  await expect.poll(() => page.evaluate(() => ({ isHidden: document.hidden, state: document.visibilityState }))).toEqual({
    isHidden,
    state: isHidden ? 'hidden' : 'visible',
  });
};

const captureVisibilityFrames = (canvas: Locator): Promise<JSHandle<YardFrameCaptureValue>> =>
  canvas.evaluateHandle((element): YardFrameCaptureValue => {
    const context = element instanceof HTMLCanvasElement ? element.getContext('webgl2') : null;
    if (!(element instanceof HTMLCanvasElement) || context === null) {
      throw new Error('Expected the warehouse WebGL canvas');
    }
    const buffer = document.createElement('canvas');
    buffer.width = Math.round(context.drawingBufferWidth / 2);
    buffer.height = Math.round(context.drawingBufferHeight / 2);
    const snapshot = buffer.getContext('2d');
    if (snapshot === null) {
      throw new Error('Could not capture warehouse scene frames');
    }
    const drawElements = context.drawElements.bind(context);
    const drawElementsInstanced = context.drawElementsInstanced.bind(context);
    let isCaptureQueued = false;
    let hasLastFrame = false;
    const handleVisibilityChange = (): void => {
      if (document.hidden && hasLastFrame && capture.before === undefined) {
        capture.before = buffer.toDataURL('image/png');
      }
    };
    const capture: YardFrameCaptureValue = {
      after: undefined,
      before: undefined,
      stop: () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        Reflect.deleteProperty(context, 'drawElements');
        Reflect.deleteProperty(context, 'drawElementsInstanced');
      },
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const schedule = (): void => {
      if (!isCaptureQueued && !document.hidden && capture.after === undefined) {
        isCaptureQueued = true;
        queueMicrotask(() => {
          isCaptureQueued = false;
          if (document.hidden) {
            return;
          }
          snapshot.drawImage(element, 0, 0, buffer.width, buffer.height);
          hasLastFrame = true;
          if (capture.before !== undefined) {
            capture.after = buffer.toDataURL('image/png');
          }
        });
      }
    };
    context.drawElements = (...args): void => {
      drawElements(...args);
      schedule();
    };
    context.drawElementsInstanced = (...args): void => {
      drawElementsInstanced(...args);
      schedule();
    };
    return capture;
  });

const toPng = (dataUrl: string): Buffer => Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');

const readCapturedCabs = async (page: Page, frame: Buffer): Promise<TruckCabPositionValue[]> =>
  (await readTruckCabPositions(page, frame, 35)).map(({ x, y }) => ({ x: 2 * x, y: 2 * y }));

test('plays two dock handoffs in order after a burst of confirmed receiving changes', async ({ context, page }, testInfo) => {
  test.setTimeout(150_000);
  const baseUrl = required(testInfo.project.use.baseURL, 'preview URL');
  const world = await createPlaybackWarehouse(context, baseUrl);
  const yard = await openYard(page, baseUrl);
  const { dock04, dock05, dock06, front, middle, rear } = await readAnchors(yard);
  const watch = await watchDockHandoff(yard.canvas, dock04, dock06, rear);
  const before = await world.readTasks();
  await yard.scene.markMotionStart();
  try {
    await Promise.all([world.fixture.releaseMiddleId, world.fixture.releaseFarId].map(id => finish(world.worker, taskById(before, id))));
    await Promise.all([expectPromotion(yard, world, world.fixture.middleId, 4), expectPromotion(yard, world, world.fixture.rearId, 6)]);

    const initialAnchors = [dock04, dock05, dock06, front, middle, rear];
    let maxMoving = 0;
    let areNeighborsStable = true;
    await expect.poll(async () => {
      const { cabs } = await readFrame(yard);
      areNeighborsStable &&= hasCabAt(cabs, dock05) && hasCabAt(cabs, front);
      maxMoving = Math.max(maxMoving, cabs.filter(cab => !hasCabAt(initialAnchors, cab)).length);
      return {
        areNeighborsStable,
        hasCorrectFleet: cabs.length === 4 && [dock04, dock05, dock06, front].every(anchor => hasCabAt(cabs, anchor)),
        maxMoving,
        sawD04BeforeRear: await watch.evaluate(trace => trace.frame !== undefined),
      };
    }, { intervals: [200], timeout: YARD_TRANSITION_MS }).toEqual({
      areNeighborsStable: true, hasCorrectFleet: true, maxMoving: 1, sawD04BeforeRear: true,
    });
    const proof = required(await watch.evaluate(trace => trace.frame), 'ordered handoff capture');
    await savePng(testInfo, 'd04-docked-while-rear-cab-waits', toPng(proof));
    await yard.scene.waitForIdle();
    await yard.scene.expectNoDrawFramesFor(REST_MS);
    await saveTiming(yard, testInfo, 'visible-handoffs-timing');

    const neighbor = taskById(await world.readTasks(), world.fixture.neighborId);
    await yard.scene.markMotionStart();
    await scanPlaceAndFinish(world, neighbor);
    await expect(receiptCard(page, neighbor).getByText(COTTAGE_SSCC, { exact: true })).toBeVisible();
    await expectFleet(yard, [dock04, dock06, front]);
    await saveTiming(yard, testInfo, 'receive-place-finish-timing');
    await savePng(testInfo, 'yard-after-receive-place-finish', (await readFrame(yard)).frame);
    expect(yard.scene.readPageErrors()).toEqual([]);
  }
  finally {
    await watch.evaluate((trace) => {
      trace.stop();
    });
    await world.worker.stop();
  }
});

test('pauses a moving yard in a hidden tab and applies WMS changes on return', async ({ browserName }, testInfo) => {
  test.setTimeout(150_000);
  expect(browserName).toBe('chromium');
  const baseUrl = required(testInfo.project.use.baseURL, 'preview URL');
  await withNativeTabVisibility(async (context) => {
    const world = await createPlaybackWarehouse(context, baseUrl);
    const yard = await openYard(await context.newPage(), baseUrl);
    const { dock04, dock05, dock06, front, middle, rear } = await readAnchors(yard);
    const { page, scene } = yard;
    try {
      await ensureVisibility(page, false);
      const visibility = await page.evaluateHandle((): DocumentVisibilityState[] => {
        const states = [document.visibilityState];
        document.addEventListener('visibilitychange', () => {
          states.push(document.visibilityState);
        });
        return states;
      });
      await world.page.bringToFront();
      await ensureVisibility(page, true);
      await page.bringToFront();
      await ensureVisibility(page, false);
      await scene.waitForIdle();
      await scene.expectNoDrawFramesFor(REST_MS);

      const capture = await captureVisibilityFrames(yard.canvas);
      try {
        await startDeparture(yard, world, dock04);
        await world.page.bringToFront();
        await ensureVisibility(page, true);
        await ensureVisibility(world.page, false);
        const pausedFrames = await scene.readDrawFrames();
        await expect.poll(() => capture.evaluate(frames => frames.before !== undefined)).toBe(true);
        const before = toPng(required(await capture.evaluate(frames => frames.before), 'last frame before native hide'));
        await savePng(testInfo, 'departure-before-hiding', before);
        const unaffected = [dock05, dock06, front, middle, rear];
        const beforeCabs = await readCapturedCabs(page, before);
        expect(beforeCabs).toHaveLength(6);
        expect(hasCabAt(beforeCabs, dock04)).toBe(false);
        expect(unaffected.every(anchor => hasCabAt(beforeCabs, anchor))).toBe(true);
        const movingBeforeHidden = required(beforeCabs.find(cab => !hasCabAt(unaffected, cab)), 'departing D04 cab before hiding');

        const far = taskById(await world.readTasks(), world.fixture.releaseFarId);
        await finish(world.worker, far);
        const promotedInBackground = taskById(await world.readTasks(), world.fixture.rearId);
        expect(promotedInBackground.unloadingPointId).toBe(world.fixture.dockIds[5]);
        expect(await scene.readDrawFrames()).toBe(pausedFrames);
        await scene.expectNoDrawFramesFor(REST_MS);
        await ensureVisibility(page, true);

        await scene.markMotionStart();
        await page.bringToFront();
        await ensureVisibility(page, false);
        await expect.poll(() => capture.evaluate(frames => frames.after !== undefined)).toBe(true);
        const resumed = toPng(required(await capture.evaluate(frames => frames.after), 'first visible yard frame'));
        await savePng(testInfo, 'first-canvas-frame-after-visibility-return', resumed);
        const resumedCabs = await readCapturedCabs(page, resumed);
        expect(resumedCabs).toHaveLength(6);
        expect(unaffected.every(anchor => hasCabAt(resumedCabs, anchor))).toBe(true);
        const movingAfterHidden = required(resumedCabs.find(cab => !hasCabAt(unaffected, cab)), 'resumed D04 cab');
        const displacement = Math.hypot(movingAfterHidden.x - movingBeforeHidden.x, movingAfterHidden.y - movingBeforeHidden.y);
        expect(displacement).toBeLessThan(POSITION_TOLERANCE_PX);
        await scene.waitForDrawFramesToExceed(pausedFrames, 'the pending yard maneuver must resume after the tab is visible');
      }
      finally {
        await capture.evaluate((frames) => {
          frames.stop();
        });
      }
      await expectPromotion(yard, world, world.fixture.middleId, 4);
      await expectPromotion(yard, world, world.fixture.rearId, 6);
      await expectFleet(yard, [dock04, dock05, dock06, front]);
      expect(await visibility.jsonValue()).toEqual(['visible', 'hidden', 'visible', 'hidden', 'visible']);
      await visibility.dispose();
      await saveTiming(yard, testInfo, 'foreground-handoff-timing');
      await savePng(testInfo, 'yard-after-background-handoff', (await readFrame(yard)).frame);
      expect(scene.readPageErrors()).toEqual([]);
    }
    finally {
      await world.worker.stop();
    }
  });
});

test('builds a fresh yard from WMS state after leaving during a maneuver and reloading', async ({ context, page }, testInfo) => {
  test.setTimeout(120_000);
  const baseUrl = required(testInfo.project.use.baseURL, 'preview URL');
  const world = await createPlaybackWarehouse(context, baseUrl);
  const yard = await openYard(page, baseUrl);
  const { dock04, dock05, dock06, front, middle } = await readAnchors(yard);
  try {
    await startDeparture(yard, world, dock04);
    const initialCanvas = await yard.canvas.elementHandle();
    await page.goto(new URL(`./${toSectionHash('warehouse')}`, baseUrl).href);
    await expect(page.getByTestId('warehouse-workspace')).toHaveCount(0);
    await expect.poll(() => initialCanvas.evaluate(element => element.isConnected)).toBe(false);
    const neighbor = taskById(await world.readTasks(), world.fixture.neighborId);
    await scanPlaceAndFinish(world, neighbor);

    await page.goto(warehouseUrl(baseUrl));
    await yard.scene.expectSceneState('ready');
    await yard.scene.waitForCameraControls();
    await yard.scene.pressCameraButton('home');
    await expectPromotion(yard, world, world.fixture.middleId, 4);
    await expect(receiptCard(page, neighbor).getByText(COTTAGE_SSCC, { exact: true })).toBeVisible();
    await expectFleet(yard, [dock04, dock06, front, middle]);
    expect(hasCabAt((await readFrame(yard)).cabs, dock05)).toBe(false);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await yard.scene.expectSceneState('ready');
    await yard.scene.waitForCameraControls();
    await yard.scene.pressCameraButton('home');
    await expectPromotion(yard, world, world.fixture.middleId, 4);
    await expect(receiptCard(page, neighbor).getByText(COTTAGE_SSCC, { exact: true })).toBeVisible();
    await expectFleet(yard, [dock04, dock06, front, middle]);
    await savePng(testInfo, 'yard-after-reload-with-reduced-motion', (await readFrame(yard)).frame);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await yard.scene.waitForIdle();
    const beforeNewMotion = await yard.scene.readDrawFrames();
    await finish(world.worker, taskById(await world.readTasks(), world.fixture.releaseFarId));
    await yard.scene.waitForDrawFramesToExceed(beforeNewMotion + 4, 'a new confirmed departure must animate after reload');
    await expectPromotion(yard, world, world.fixture.rearId, 6);
    await expectFleet(yard, [dock04, dock06, front]);
    expect(yard.scene.readPageErrors()).toEqual([]);
  }
  finally {
    await world.worker.stop();
  }
});
