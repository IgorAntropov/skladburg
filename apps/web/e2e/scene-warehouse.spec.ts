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

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { expect } from '@playwright/test';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import { randomUUID } from 'node:crypto';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';
import type { SceneRobotValue } from './robots/scene-robot.ts';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  toObjectHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import {
  fundExchangeTrip,
  MINUTE_MS,
  TRIP_ARRIVAL_ADVANCE_MS,
  TRIP_DEPARTURE_ADVANCE_MS,
} from './robots/exchange-trip-journey.ts';
import { createNetworkTripsRobot } from './robots/network-trips-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import { createTransportRobot } from './robots/transport-robot.ts';
import {
  CUSTOMER_WAREHOUSE_HASH,
  prepareWarehouseDelivery,
  scanCode,
} from './robots/warehouse-delivery-robot.ts';
import {
  openTripPicking,
  scanDeliveredPallet,
  scanPutAwayCell,
  scanTripPallet,
  TRIP_ORIGIN_WAREHOUSE_ID,
} from './robots/warehouse-trip-handoff-robot.ts';

test.use({ viewport: DESKTOP_VIEWPORT });

const IN_TRANSIT_ADVANCE_MS = TRIP_DEPARTURE_ADVANCE_MS + 240 * MINUTE_MS;
const REST_PERIOD_MS = 700;
const MIN_DOCK_MOTION_FRAMES = 10;
const MIN_WAREHOUSE_MOTION_FRAMES = 5;
const MIN_YARD_HANDOFF_FRAMES = 32;
const CANVAS_ONLY_STYLE = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }';
const KAZAN_WAREHOUSE_ID = OWN_NETWORK_SITES[2].id;
const COTTAGE_SSCC = '000000000000000017';
const YOGURT_SSCC = '000000000000000024';

const expectDockTruckMotion = async (
  scene: SceneRobotValue,
  canvas: Locator,
  trigger: () => Promise<void>,
  testInfo: TestInfo,
  name: string,
  minFrames = MIN_DOCK_MOTION_FRAMES,
): Promise<Buffer> => {
  await scene.waitForIdle();
  const before = await canvas.screenshot({ style: CANVAS_ONLY_STYLE });
  const beforeFrames = await scene.readDrawFrames();
  await trigger();
  await scene.waitForDrawFramesToExceed(beforeFrames + minFrames - 1, `${name} did not animate`);
  await canvas.screenshot({ path: testInfo.outputPath(`${name}-motion.png`), style: CANVAS_ONLY_STYLE });
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  const after = await canvas.screenshot({ path: testInfo.outputPath(`${name}-settled.png`), style: CANVAS_ONLY_STYLE });
  expect(after.equals(before), `${name} did not change the dock scene`).toBe(false);
  return after;
};

const callReceiving = async <TInput extends DescMessage, TOutput extends DescMessage>(
  worker: EngineWorkerRobotValue,
  method: DescMethodUnary<TInput, TOutput>,
  request: MessageInitShape<TInput>,
): Promise<MessageShape<TOutput>> => {
  const body = toBinary(method.input, create(method.input, request));
  return fromBinary(method.output, await worker.call(`${method.parent.typeName}/${method.name}`, body));
};

const readTruckCabRows = (page: Page, screenshot: Buffer): Promise<number[]> => page.evaluate(async (base64): Promise<number[]> => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();

  const surface = document.createElement('canvas');
  const { naturalHeight: height, naturalWidth: width } = image;
  surface.width = width;
  surface.height = height;
  const context = surface.getContext('2d');
  if (context === null) {
    throw new Error('Could not read the warehouse scene screenshot');
  }
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  const cabPixels = new Uint8Array(width * height);
  for (let pixel = 0; pixel < cabPixels.length; pixel += 1) {
    const offset = pixel * 4;
    const green = data[offset + 1] ?? 0;
    const red = data[offset] ?? 0;
    const blue = data[offset + 2] ?? 0;
    cabPixels[pixel] = red - green >= 20 && blue - green >= 16 ? 1 : 0;
  }

  const cabRows: number[] = [];
  for (let pixel = 0; pixel < cabPixels.length; pixel += 1) {
    if (cabPixels[pixel] !== 1) {
      continue;
    }
    const component = [pixel];
    cabPixels[pixel] = 0;
    let rowSum = 0;
    for (const current of component) {
      rowSum += Math.floor(current / width);
      const column = current % width;
      for (const next of [
        current - width,
        current + width,
        column > 0 ? current - 1 : -1,
        column < width - 1 ? current + 1 : -1,
      ]) {
        if (cabPixels[next] === 1) {
          cabPixels[next] = 0;
          component.push(next);
        }
      }
    }
    if (component.length >= 100) {
      cabRows.push(rowSum / component.length);
    }
  }

  return cabRows.sort((current, prev) => prev - current);
}, screenshot.toString('base64'));

test('renders the dock and the confirmed receiving movements, then returns to rest', async ({ context, page }, testInfo) => {
  test.setTimeout(150_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const supplierPage = await context.newPage();
  const storePage = await context.newPage();
  await storePage.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await storePage.addInitScript({ content: createStoreSystemThemeScript() });
  await storePage.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const scene = createSceneRobot(storePage);
  scene.watchPageErrors();
  const receiving = storePage.getByTestId('warehouse-receiving-task');
  const canvas = storePage.getByTestId('scene-viewport').locator('canvas');
  let beforeArrival: Buffer = Buffer.alloc(0);
  const { sscc } = await prepareWarehouseDelivery({
    onBeforeArrival: async () => {
      await scene.chooseGraphicsPreference('low');
      await scene.expectSceneState('ready');
      await scene.expectOneCanvas();
      await scene.waitForCameraControls();
      await expect(receiving).toHaveCount(0);
      await scene.waitForIdle();
      beforeArrival = await canvas.screenshot();
    },
    page,
    storePage,
    supplierPage,
  });

  await expect(receiving).toBeVisible();
  await scene.waitForIdle();
  expect((await canvas.screenshot({ path: testInfo.outputPath('dock-day.png') })).equals(beforeArrival)).toBe(false);

  await receiving.getByTestId('warehouse-claim-receiving').click();
  await receiving.getByTestId('warehouse-enter-sscc').click();
  const receive = receiving.getByTestId('warehouse-receive-form');
  await receive.locator('input[name="sscc"]').fill(sscc);
  const beforeReceive = await scene.readDrawFrames();
  await receive.getByTestId('warehouse-receive-submit').click();
  const placement = receiving.getByTestId('warehouse-placement');
  await expect(placement).toBeVisible();
  await scene.waitForDrawFramesToExceed(beforeReceive + 4, 'the dock-to-staging motion did not draw');
  await scene.waitForIdle();

  const placementCell = placement.locator('select');
  const firstCell = placementCell.locator('option').nth(1);
  const cellId = await firstCell.getAttribute('value');
  const beforeScan = await scene.readDrawFrames();
  await scanCode(placement, await firstCell.innerText(), true);
  if (cellId === null) {
    throw new Error('Missing placement cell ID');
  }
  await expect(placementCell).toHaveValue(cellId);
  await expect.poll(() => new URL(storePage.url()).hash).toBe(CUSTOMER_WAREHOUSE_HASH);
  await scene.waitForDrawFramesToExceed(beforeScan, 'scanning a cell did not update the scene');
  await scene.waitForIdle();

  const beforePlacement = await scene.readDrawFrames();
  await placement.getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(0);
  await scene.waitForDrawFramesToExceed(beforePlacement + 24, 'the staging-to-cell motion did not draw');
  await canvas.screenshot({ path: testInfo.outputPath('warehouse-forklift-put-away.png') });
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(700);
  await receiving.getByTestId('warehouse-finish-receiving').click();

  const beforeNight = await scene.readDrawFrames();
  await scene.switchColorScheme('dark');
  await scene.expectThemeAttribute('dark');
  await scene.waitForDrawFramesToExceed(beforeNight + 4, 'the night transition did not draw');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(700);
  await canvas.screenshot({ path: testInfo.outputPath('warehouse-night.png') });
  await scene.tapFreeAreaCenter();
  await expect.poll(() => new URL(storePage.url()).hash).toBe(`#/cells/${cellId}`);

  await createPersonaRobot(storePage).selectPersona(PERSONAS.constructionCustomer);
  await expect(storePage.getByTestId('warehouse-object-unavailable')).toBeVisible();
  await scene.expectNoCanvas();
  expect(scene.readPageErrors()).toEqual([]);
});

test('loads, transports and puts away the same pallet on an assigned warehouse trip', async ({ context, page }, testInfo) => {
  test.setTimeout(180_000);
  await context.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await context.addInitScript({ content: createStoreSystemThemeScript() });
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const networkScene = createSceneRobot(page);
  const networkTrips = createNetworkTripsRobot(page);
  networkScene.watchPageErrors();
  const { advanceClock, carrierPage, shipTrip, supplierPage, tripAddress } = await fundExchangeTrip({
    context,
    kind: VehicleCargoKind.GENERAL,
    originWarehouseId: TRIP_ORIGIN_WAREHOUSE_ID,
    page,
    shipperSide: 'supplier',
  });
  const carrier = createTransportRobot(carrierPage);
  await carrier.expectTripStatus(TripStatus.ASSIGNED);

  const supplierScene = createSceneRobot(supplierPage);
  const supplierCanvas = supplierPage.getByTestId('scene-viewport').locator('canvas');
  supplierScene.watchPageErrors();
  await supplierPage.bringToFront();
  await supplierPage.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const picking = await openTripPicking(supplierPage);
  await supplierScene.chooseGraphicsPreference('low');
  await supplierScene.expectSceneState('ready');
  await supplierScene.expectOneCanvas();
  const { confirmPicking, confirmShipment, sscc } = await scanTripPallet(picking);
  await expectDockTruckMotion(supplierScene, supplierCanvas, confirmPicking, testInfo, 'supplier-dock-approach');

  await page.bringToFront();
  await networkTrips.openFromApp();
  await networkScene.chooseGraphicsPreference('low');
  await networkScene.expectSceneState('ready');
  await networkScene.waitForIdle();
  const beforeNetworkLoad = await networkScene.readDrawFrames();

  await supplierPage.bringToFront();
  await shipTrip(async () => {
    await supplierScene.waitForIdle();
    const beforeShipment = await supplierScene.readDrawFrames();
    await confirmShipment();
    await supplierScene.waitForDrawFramesToExceed(
      beforeShipment + 32,
      'the cell-to-dock loading did not draw',
    );
    await supplierCanvas.screenshot({ path: testInfo.outputPath('warehouse-loading.png') });
    await supplierScene.waitForIdle();
    await supplierScene.expectNoDrawFramesFor(REST_PERIOD_MS);
    await supplierCanvas.screenshot({ path: testInfo.outputPath('warehouse-loaded.png') });
  });

  await page.bringToFront();
  await networkTrips.expectStatus(tripAddress, TripStatus.LOADED);
  await networkScene.waitForDrawFramesToExceed(beforeNetworkLoad, 'the loaded truck did not draw on the map');
  await networkScene.waitForIdle();

  const storePage = await context.newPage();
  await storePage.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const storeScene = createSceneRobot(storePage);
  storeScene.watchPageErrors();
  await createPersonaRobot(storePage).openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshStorekeeper.id);
  await expect(storePage.getByTestId('warehouse-workspace')).toBeVisible();
  await storeScene.expectSceneState('ready');
  await storeScene.expectOneCanvas();
  const receiving = storePage.getByTestId('warehouse-receiving-task');
  const storeCanvas = storePage.getByTestId('scene-viewport').locator('canvas');
  await expect(receiving).toHaveCount(0);

  await supplierPage.bringToFront();
  await expectDockTruckMotion(supplierScene, supplierCanvas, async () => {
    await advanceClock(IN_TRANSIT_ADVANCE_MS);
    await carrier.expectTripStatus(TripStatus.IN_TRANSIT);
  }, testInfo, 'supplier-dock-departure');

  await page.bringToFront();
  await networkTrips.expectStatus(tripAddress, TripStatus.IN_TRANSIT);
  const duringTravel = await networkScene.readDrawFrames();
  await networkScene.waitForDrawFramesToExceed(duringTravel + 2, 'the truck did not sustain frames during travel');
  await page.getByTestId('scene-viewport').locator('canvas').screenshot({ path: testInfo.outputPath('warehouse-trip-in-transit.png') });

  await storePage.bringToFront();
  await expectDockTruckMotion(storeScene, storeCanvas, async () => {
    await advanceClock(TRIP_ARRIVAL_ADVANCE_MS);
    await expect(receiving.getByTestId('warehouse-claim-receiving')).toBeVisible();
  }, testInfo, 'recipient-dock-approach');

  await page.bringToFront();
  await networkTrips.expectStatus(tripAddress, TripStatus.ARRIVED);
  await carrier.expectTripStatus(TripStatus.ARRIVED);
  await networkScene.waitForIdle();
  await networkScene.expectNoDrawFramesFor(REST_PERIOD_MS);

  await storePage.bringToFront();
  const receive = await scanDeliveredPallet(receiving, sscc);
  await storeScene.waitForIdle();
  const beforeUnload = await storeScene.readDrawFrames();
  await receive.click();
  const placement = receiving.getByTestId('warehouse-placement');
  await expect(placement).toBeVisible();
  const receivedPallet = receiving.getByText(sscc, { exact: true });
  await expect(receivedPallet).toBeVisible();
  await storeScene.waitForDrawFramesToExceed(beforeUnload + MIN_WAREHOUSE_MOTION_FRAMES - 1, 'the dock-to-staging motion did not draw');
  await storeCanvas.screenshot({ path: testInfo.outputPath('warehouse-unloading.png') });
  await storeScene.waitForIdle();

  const cellCode = await scanPutAwayCell(placement);
  await storeScene.waitForIdle();
  const beforePutAway = await storeScene.readDrawFrames();
  await placement.getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(0);
  await expect(receiving.locator('li').filter({ has: storePage.getByText(sscc, { exact: true }) })).toContainText(cellCode);
  await storeScene.waitForDrawFramesToExceed(beforePutAway + MIN_WAREHOUSE_MOTION_FRAMES - 1, 'the staging-to-cell motion did not draw');
  await storeCanvas.screenshot({ path: testInfo.outputPath('warehouse-trip-put-away.png') });
  await storeScene.waitForIdle();
  await storeScene.expectNoDrawFramesFor(REST_PERIOD_MS);
  await expectDockTruckMotion(storeScene, storeCanvas, async () => {
    const finish = receiving.getByTestId('warehouse-finish-receiving');
    await finish.click();
    await expect(finish).toHaveCount(0);
  }, testInfo, 'recipient-dock-departure');
  await expectNoAxeViolations(storePage);

  expect(networkScene.readPageErrors()).toEqual([]);
  expect(supplierScene.readPageErrors()).toEqual([]);
  expect(storeScene.readPageErrors()).toEqual([]);
});

test('serves the warehouse queue in arrival order even when the waiting receipt is opened', async ({ context, page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  await createPersonaRobot(page).openAsPersona(toObjectHash(toWarehouseRoute(KAZAN_WAREHOUSE_ID)), PERSONAS.freshCustomer.id);
  const receipts = page.getByTestId('warehouse-receiving-task');
  await expect(receipts).toHaveCount(2);
  await scene.chooseGraphicsPreference('low');
  await scene.expectSceneState('ready');
  await scene.expectOneCanvas();
  await scene.waitForCameraControls();
  await scene.pressCameraButton('zoom-out');
  await scene.waitForIdle();

  const workerPage = await context.newPage();
  const worker = await createEngineWorkerRobot(workerPage, DEAL_CUSTOMER);
  const { method } = WarehouseReceivingService;
  const canvas = page.getByTestId('scene-viewport').locator('canvas');
  try {
    const { tasks } = await callReceiving(worker, method.listReceivingTasks, { warehouseId: KAZAN_WAREHOUSE_ID });
    expect(tasks.map(task => ({ sscc: task.expectedUnits[0]?.sscc, status: task.status }))).toEqual([
      { sscc: COTTAGE_SSCC, status: ReceivingTaskStatus.OPEN },
      { sscc: YOGURT_SSCC, status: ReceivingTaskStatus.OPEN },
    ]);
    const [firstArrival, secondArrival] = tasks;
    if (firstArrival === undefined || secondArrival === undefined) {
      throw new Error('Expected both Kazan arrivals');
    }
    const first = receipts.filter({ has: page.locator(`a[href="#/deals/${firstArrival.dealId}"]`) });
    const second = receipts.filter({ has: page.locator(`a[href="#/deals/${secondArrival.dealId}"]`) });

    await page.bringToFront();
    const before = await canvas.screenshot({ path: testInfo.outputPath('yard-queue-before.png'), style: CANVAS_ONLY_STYLE });
    const cabRows = await readTruckCabRows(page, before);
    expect(cabRows).toHaveLength(2);
    const [dockCabRow, waitingCabRow] = cabRows;
    if (dockCabRow === undefined || waitingCabRow === undefined) {
      throw new Error('Expected separate dock and parking trucks');
    }
    expect(dockCabRow - waitingCabRow).toBeGreaterThan(20);
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

    await first.getByTestId('warehouse-claim-receiving').click();
    await expect(first.getByText(COTTAGE_SSCC, { exact: true })).toBeVisible();
    await second.getByTestId('warehouse-claim-receiving').click();
    await expect(second.getByText(YOGURT_SSCC, { exact: true })).toBeVisible();
    await second.getByTestId('warehouse-enter-sscc').click();
    const secondForm = second.getByTestId('warehouse-receive-form');
    await expect(secondForm).toBeVisible();
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
    const withWaitingReceiptOpen = await canvas.screenshot({ style: CANVAS_ONLY_STYLE });
    expect(withWaitingReceiptOpen.equals(before), 'Opening the waiting receipt moved a truck').toBe(true);

    const { tasks: claimedTasks } = await callReceiving(worker, method.listReceivingTasks, { warehouseId: KAZAN_WAREHOUSE_ID });
    const firstTask = claimedTasks.find(task => task.id === firstArrival.id);
    const secondTask = claimedTasks.find(task => task.id === secondArrival.id);
    if (firstTask === undefined || secondTask === undefined) {
      throw new Error('Expected both Kazan receipts to be claimed');
    }
    const { finishReceivingTask } = method;
    const finishReceipt = async (taskId: string, expectedVersion: number): Promise<void> => {
      const { task } = await callReceiving(worker, finishReceivingTask, {
        expectedVersion,
        idempotencyKey: randomUUID(),
        taskId,
        warehouseId: KAZAN_WAREHOUSE_ID,
      });
      expect(task?.status).toBe(ReceivingTaskStatus.READY_FOR_RECONCILIATION);
    };
    const promoted = await expectDockTruckMotion(scene, canvas, async () => {
      await finishReceipt(firstTask.id, firstTask.version);
    }, testInfo, 'yard-queue-handoff', MIN_YARD_HANDOFF_FRAMES);
    const promotedCabs = await readTruckCabRows(page, promoted);
    expect(promotedCabs).toHaveLength(1);
    expect(promotedCabs[0]).toBeCloseTo(dockCabRow, -1);
    await expect(secondForm).toBeVisible();

    const emptyYard = await expectDockTruckMotion(scene, canvas, async () => {
      await finishReceipt(secondTask.id, secondTask.version);
      await expect(secondForm).toHaveCount(0);
    }, testInfo, 'yard-queue-last-departure');
    expect(await readTruckCabRows(page, emptyYard)).toHaveLength(0);
    await expectNoAxeViolations(page);
    expect(scene.readPageErrors()).toEqual([]);
  }
  finally {
    await worker.stop();
    await workerPage.close();
  }
});
