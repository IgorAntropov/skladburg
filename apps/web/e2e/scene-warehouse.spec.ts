import type {
  DescMessage,
  DescMethodUnary,
  MessageInitShape,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  Locator,
  TestInfo,
} from '@playwright/test';
import type { ListReceivingTasksResponse } from '@skladburg/contracts/wms/v1/receiving';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { expect } from '@playwright/test';
import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import { randomUUID } from 'node:crypto';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';
import type { SceneRobotValue } from './robots/scene-robot.ts';
import type { TruckCabPositionValue } from './robots/warehouse-cab-observer.ts';

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
import { storeSixDockWarehouse } from './fixtures/sixDockWarehouse.ts';
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
  readTruckCabPositions,
  watchDockHandoff,
} from './robots/warehouse-cab-observer.ts';
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
const RACK_GRID_STEP_MM = 100;
const MIN_DOCK_MOTION_FRAMES = 10;
const MIN_WAREHOUSE_MOTION_FRAMES = 5;
const MIN_YARD_HANDOFF_FRAMES = 32;
const SIX_DOCK_PROMOTIONS_TIMEOUT_MS = 60_000;
const CAB_POSITION_TOLERANCE_PX = 10;
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

const projectCabDepth = ({ x, y }: TruckCabPositionValue): number => y * Math.sqrt(3) - x;

const projectCabLane = ({ x, y }: TruckCabPositionValue): number => y * Math.sqrt(3) + x;

const hasCabAt = (cabs: readonly TruckCabPositionValue[], target: TruckCabPositionValue): boolean =>
  cabs.some(cab => Math.hypot(cab.x - target.x, cab.y - target.y) < CAB_POSITION_TOLERANCE_PX);

test('moves a rack preview and renders the saved rack on the same warehouse canvas', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  await createPersonaRobot(page).openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await scene.chooseGraphicsPreference('low');
  await scene.expectSceneState('ready');
  await scene.expectOneCanvas();
  await scene.waitForCameraControls();
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

  const canvas = page.getByTestId('scene-viewport').locator('canvas');
  const initialCanvas = await canvas.elementHandle();
  const initial = await canvas.screenshot({ path: testInfo.outputPath('warehouse-before-construction.png'), style: CANVAS_ONLY_STYLE });
  const initialTriangles = await scene.readTriangles();
  const workspace = page.getByTestId('warehouse-workspace');
  const placement = workspace.getByTestId('warehouse-rack-placement');
  const addresses = placement.getByTestId('warehouse-rack-preview').locator('li');
  const grid = placement.getByTestId('warehouse-rack-grid');
  const selection = grid.getByTestId('warehouse-rack-grid-selection');
  const submit = placement.getByTestId('warehouse-rack-submit');

  const beforeLayout = await scene.readDrawFrames();
  await workspace.locator('button[id$="-trigger-layout"]').click();
  await expect(addresses).toHaveCount(4);
  await expect(selection).toHaveAttribute('data-x-mm', /^\d+$/u);
  const initialX = Number(await selection.getAttribute('data-x-mm'));
  await scene.waitForDrawFramesToExceed(beforeLayout, 'the zone and rack preview did not draw');
  await expect.poll(scene.readTriangles).toBeGreaterThan(initialTriangles);
  await scene.waitForIdle();
  await expect.poll(async () => (await page.getByTestId('hud-free-area').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(120);
  await page.screenshot({ path: testInfo.outputPath('warehouse-layout-preview.png') });
  const preview = await canvas.screenshot({ path: testInfo.outputPath('warehouse-rack-preview.png'), style: CANVAS_ONLY_STYLE });
  const previewTriangles = await scene.readTriangles();
  expect(preview.equals(initial), 'the layout did not change the warehouse scene').toBe(false);
  expect(previewTriangles).toBeGreaterThan(initialTriangles);

  const beforeMove = await scene.readDrawFrames();
  await grid.press('ArrowRight');
  await expect(selection).toHaveAttribute('data-x-mm', String(initialX + RACK_GRID_STEP_MM));
  await expect(submit).toBeEnabled();
  await scene.waitForDrawFramesToExceed(beforeMove, 'moving the rack did not draw');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  const moved = await canvas.screenshot({ path: testInfo.outputPath('warehouse-rack-moved.png'), style: CANVAS_ONLY_STYLE });
  expect(moved.equals(preview), 'the moved rack did not change the warehouse scene').toBe(false);
  expect(await scene.readTriangles()).toBe(previewTriangles);

  const newAddresses = (await addresses.allTextContents()).map(text => text.trim());
  const beforeSave = await scene.readDrawFrames();
  await submit.press('Enter');
  await expect(placement.getByTestId('warehouse-rack-saved')).toBeVisible();
  await expect(placement.getByTestId('warehouse-rack-print')).toBeVisible();
  await expect(addresses).toHaveCount(0);
  await scene.waitForDrawFramesToExceed(beforeSave, 'the saved rack did not draw');
  await scene.waitForIdle();
  const saved = await canvas.screenshot({ path: testInfo.outputPath('warehouse-rack-saved.png'), style: CANVAS_ONLY_STYLE });
  expect(saved.equals(moved), 'the saved rack did not replace the preview in the warehouse scene').toBe(false);
  expect(saved.equals(initial), 'the committed rack is missing from the warehouse scene').toBe(false);
  expect(await scene.readTriangles()).toBeGreaterThan(initialTriangles);

  const beforeAddresses = await scene.readDrawFrames();
  await workspace.locator('button[id$="-trigger-addresses"]').click();
  const cellLinks = workspace.getByTestId('warehouse-addresses').locator('a[href^="#/cells/"]');
  for (const code of newAddresses) {
    await expect(cellLinks.filter({ hasText: new RegExp(`(?:^|\\s)${code}$`, 'u') })).toHaveCount(1);
  }
  await scene.waitForDrawFramesToExceed(beforeAddresses, 'opening the addresses tab did not redraw the scene');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  await canvas.screenshot({ path: testInfo.outputPath('warehouse-saved-addresses.png'), style: CANVAS_ONLY_STYLE });
  expect(await scene.readTriangles()).toBeGreaterThan(initialTriangles);
  await scene.expectOneCanvas();
  expect(await canvas.evaluate((current, original) => current === original, initialCanvas)).toBe(true);
  expect(scene.readPageErrors()).toEqual([]);
});

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
  await expect(receiving.getByTestId('warehouse-finish-receiving')).toHaveCount(0);

  await scene.waitForIdle();
  const beforeThemeChange = await canvas.screenshot({ style: CANVAS_ONLY_STYLE });
  await scene.switchColorScheme('dark');
  await scene.expectThemeAttribute('dark');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(700);
  const afterThemeChange = await canvas.screenshot({ path: testInfo.outputPath('warehouse-dark-hud.png'), style: CANVAS_ONLY_STYLE });
  expect(afterThemeChange.equals(beforeThemeChange)).toBe(true);
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
  await storeScene.waitForCameraControls();
  await storeScene.pressCameraButton('zoom-out');
  await storeScene.waitForIdle();
  await storeScene.pressCameraButton('zoom-out');
  await storeScene.waitForIdle();
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
  const yardStatus = receiving.getByTestId('warehouse-receiving-dock');
  const parked = await expectDockTruckMotion(storeScene, storeCanvas, async () => {
    await advanceClock(TRIP_ARRIVAL_ADVANCE_MS);
    await expect(yardStatus.getByTestId('yard-waiting-reason')).toHaveAttribute('data-reason', 'WAITING_DOCUMENTS');
  }, testInfo, 'recipient-parking-waiting-documents');
  const parkedCabs = await readTruckCabPositions(storePage, parked);
  expect(parkedCabs).toHaveLength(1);

  const claim = receiving.getByTestId('warehouse-claim-receiving');
  await claim.click();
  await expect(claim).toHaveCount(0);
  await expect(receiving.getByTestId('warehouse-enter-sscc')).toHaveCount(0);

  await page.bringToFront();
  await networkTrips.expectStatus(tripAddress, TripStatus.ARRIVED);
  await carrier.expectTripStatus(TripStatus.ARRIVED);
  await networkScene.waitForIdle();
  await networkScene.expectNoDrawFramesFor(REST_PERIOD_MS);

  await storePage.bringToFront();
  const submitTitle = carrierPage.getByTestId('transport-carrier-title-submit');
  const docked = await expectDockTruckMotion(storeScene, storeCanvas, async () => {
    await carrierPage.bringToFront();
    await submitTitle.click();
    await expect(submitTitle).toHaveCount(0);
    await storePage.bringToFront();
    await expect(yardStatus).toHaveText('Док D01');
    await expect(receiving.getByTestId('warehouse-enter-sscc')).toBeVisible();
  }, testInfo, 'recipient-dock-approach');
  const dockedCabs = await readTruckCabPositions(storePage, docked);
  expect(dockedCabs).toHaveLength(1);
  expect(projectCabDepth(dockedCabs[0] ?? { x: 0, y: 0 })).toBeGreaterThan(projectCabDepth(parkedCabs[0] ?? { x: 0, y: 0 }));

  const receive = await scanDeliveredPallet(receiving, sscc, true);
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

test('receives goods at two assigned docks and advances the waiting truck', async ({ context, page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  await createPersonaRobot(page).openAsPersona(toObjectHash(toWarehouseRoute(KAZAN_WAREHOUSE_ID)), PERSONAS.freshCustomer.id);
  const receipts = page.getByTestId('warehouse-receiving-task');
  await expect(receipts).toHaveCount(3);
  await scene.chooseGraphicsPreference('low');
  await scene.expectSceneState('ready');
  await scene.expectOneCanvas();
  await scene.waitForCameraControls();
  await scene.pressCameraButton('zoom-out');
  await scene.waitForIdle();
  await scene.pressCameraButton('zoom-out');
  await scene.waitForIdle();

  const workerPage = await context.newPage();
  const worker = await createEngineWorkerRobot(workerPage, DEAL_CUSTOMER);
  const { method } = WarehouseReceivingService;
  const readReceipts = (): Promise<ListReceivingTasksResponse> =>
    callReceiving(worker, method.listReceivingTasks, { warehouseId: KAZAN_WAREHOUSE_ID });
  const canvas = page.getByTestId('scene-viewport').locator('canvas');
  try {
    const { tasks } = await readReceipts();
    expect(tasks).toHaveLength(3);
    expect(tasks.slice(0, 2).map(task => ({ sscc: task.expectedUnits[0]?.sscc, status: task.status }))).toEqual([
      { sscc: COTTAGE_SSCC, status: ReceivingTaskStatus.OPEN },
      { sscc: YOGURT_SSCC, status: ReceivingTaskStatus.OPEN },
    ]);
    const [firstArrival, secondArrival, waitingArrival] = tasks;
    if (firstArrival?.unloadingPointId === undefined || secondArrival?.unloadingPointId === undefined || waitingArrival === undefined) {
      throw new Error('Expected two assigned Kazan docks and a waiting receipt');
    }
    expect(firstArrival.unloadingPointId).not.toBe(secondArrival.unloadingPointId);
    expect(waitingArrival.status).toBe(ReceivingTaskStatus.OPEN);
    expect(waitingArrival.unloadingPointId).toBeUndefined();
    const first = receipts.filter({ has: page.locator(`a[href="#/deals/${firstArrival.dealId}"]`) });
    const second = receipts.filter({ has: page.locator(`a[href="#/deals/${secondArrival.dealId}"]`) });
    const waiting = receipts.filter({ has: page.locator(`a[href="#/deals/${waitingArrival.dealId}"]`) });
    const firstDock = first.getByTestId('warehouse-receiving-dock');
    const secondDock = second.getByTestId('warehouse-receiving-dock');
    const waitingDock = waiting.getByTestId('warehouse-receiving-dock');
    const waitingReceive = waiting.getByTestId('warehouse-enter-sscc');
    await expect(firstDock).toContainText('D01');
    await expect(secondDock).toContainText('D02');
    const [firstDockLabel, secondDockLabel] = await Promise.all([firstDock.innerText(), secondDock.innerText()]);
    await expect(waitingDock).toBeVisible();
    await expect(waitingDock).not.toHaveText(/D0[12]/u);

    await page.bringToFront();
    const before = await canvas.screenshot({ path: testInfo.outputPath('kazan-two-docks.png'), style: CANVAS_ONLY_STYLE });
    const initialCabs = await readTruckCabPositions(page, before);
    expect(initialCabs).toHaveLength(3);
    const initialDockCabs = initialCabs.toSorted((first, second) => projectCabDepth(first) - projectCabDepth(second)).slice(1);
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

    const claimWaiting = waiting.getByTestId('warehouse-claim-receiving');
    await claimWaiting.click();
    await expect(claimWaiting).toHaveCount(0);
    await expect(waitingReceive).toHaveCount(0);
    await second.getByTestId('warehouse-claim-receiving').click();
    await expect(second.getByText(YOGURT_SSCC, { exact: true })).toBeVisible();
    const firstReceive = await scanDeliveredPallet(first, COTTAGE_SSCC);
    await expectDockTruckMotion(scene, canvas, async () => {
      await firstReceive.click();
      await expect(first.getByTestId('warehouse-placement')).toHaveCount(1);
    }, testInfo, 'kazan-first-unload');

    const { tasks: startedTasks } = await readReceipts();
    const markedTask = startedTasks.find(task => task.id === secondArrival.id);
    const markedBatch = markedTask?.expectedUnits[0]?.batches[0];
    if (markedTask === undefined || markedBatch === undefined) {
      throw new Error('Expected the marked yogurt receipt');
    }
    expect(markedBatch.markingCodes).toHaveLength(3);
    await expectDockTruckMotion(scene, canvas, async () => {
      const { task } = await callReceiving(worker, method.receiveHandlingUnit, {
        batchEvidence: [{ batchIndex: 0, markingCodes: markedBatch.markingCodes, quantityBase: markedBatch.quantityBase }],
        expectedVersion: markedTask.version,
        idempotencyKey: randomUUID(),
        taskId: markedTask.id,
        unit: { case: 'sscc', value: YOGURT_SSCC },
        warehouseId: KAZAN_WAREHOUSE_ID,
      });
      expect(task?.receivedUnits[0]?.batchFacts[0]?.markingCodes).toEqual(markedBatch.markingCodes);
      await expect(second.getByTestId('warehouse-placement')).toHaveCount(1);
    }, testInfo, 'kazan-second-unload');

    const { tasks: acceptedTasks } = await readReceipts();
    const firstTask = acceptedTasks.find(task => task.id === firstArrival.id);
    const secondTask = acceptedTasks.find(task => task.id === secondArrival.id);
    if (firstTask === undefined || secondTask === undefined) {
      throw new Error('Expected both open Kazan receipts');
    }
    for (const [task, arrival, sscc] of [[firstTask, firstArrival, COTTAGE_SSCC], [secondTask, secondArrival, YOGURT_SSCC]] as const) {
      expect(task.status).toBe(ReceivingTaskStatus.IN_PROGRESS);
      expect(task.unloadingPointId).toBe(arrival.unloadingPointId);
      expect(task.receivedUnits.map(unit => unit.balanceAtReceipt?.handlingUnit?.sscc)).toEqual([sscc]);
    }
    const waitingReceipt = acceptedTasks.find(task => task.id === waitingArrival.id);
    expect(waitingReceipt?.status).toBe(ReceivingTaskStatus.IN_PROGRESS);
    expect(waitingReceipt?.unloadingPointId).toBeUndefined();

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
    const afterSecondDeparture = await expectDockTruckMotion(scene, canvas, async () => {
      await finishReceipt(secondTask.id, secondTask.version);
    }, testInfo, 'kazan-d02-departure-and-queue-advance', MIN_YARD_HANDOFF_FRAMES);
    const assignedCabs = await readTruckCabPositions(page, afterSecondDeparture);
    expect(assignedCabs).toHaveLength(2);
    expect(assignedCabs.every(cab => initialDockCabs.some(({ x, y }) => Math.hypot(x - cab.x, y - cab.y) < 5))).toBe(true);
    const { tasks: remainingTasks } = await readReceipts();
    const remainingReceipt = remainingTasks.find(task => task.id === firstTask.id);
    expect(remainingReceipt).toMatchObject({
      status: ReceivingTaskStatus.IN_PROGRESS,
      unloadingPointId: firstArrival.unloadingPointId,
      version: firstTask.version,
    });
    expect(remainingReceipt?.receivedUnits).toEqual(firstTask.receivedUnits);
    expect(remainingTasks.find(task => task.id === waitingArrival.id)).toMatchObject({
      status: ReceivingTaskStatus.IN_PROGRESS,
      unloadingPointId: secondArrival.unloadingPointId,
    });
    await expect(firstDock).toHaveText(firstDockLabel);
    await expect(waitingDock).toHaveText(secondDockLabel);
    await expect(waitingReceive).toBeVisible();
    await expect(first.getByTestId('warehouse-placement')).toHaveCount(1);

    const afterFirstDeparture = await expectDockTruckMotion(scene, canvas, async () => {
      await finishReceipt(firstTask.id, firstTask.version);
    }, testInfo, 'kazan-d01-departure');
    expect(await readTruckCabPositions(page, afterFirstDeparture)).toHaveLength(1);
    await expect(waitingDock).toHaveText(secondDockLabel);

    const { tasks: finalTasks } = await readReceipts();
    const finalTask = finalTasks.find(task => task.id === waitingArrival.id);
    if (finalTask === undefined) {
      throw new Error('Expected the receipt promoted from parking');
    }
    const emptyYard = await expectDockTruckMotion(scene, canvas, async () => {
      await finishReceipt(finalTask.id, finalTask.version);
    }, testInfo, 'kazan-third-departure');
    expect(await readTruckCabPositions(page, emptyYard)).toHaveLength(0);
    await expectNoAxeViolations(page);
    expect(scene.readPageErrors()).toEqual([]);
  }
  finally {
    await worker.stop();
    await workerPage.close();
  }
});

test('uses the rear parking place and keeps both new assignments on a six-dock yard', async ({ context, page }, testInfo) => {
  test.setTimeout(150_000);
  const { method } = WarehouseReceivingService;
  const scope = { warehouseId: KAZAN_WAREHOUSE_ID };
  const warehouseHash = toObjectHash(toWarehouseRoute(KAZAN_WAREHOUSE_ID));
  const seedPage = await context.newPage();
  const seedWorker = await createEngineWorkerRobot(seedPage, DEAL_CUSTOMER);
  const [{ tasks: seeded }, { topology }, { warehouses }] = await Promise.all([
    callReceiving(seedWorker, method.listReceivingTasks, scope),
    callReceiving(seedWorker, WarehouseTopologyService.method.getWarehouseTopology, scope),
    callReceiving(seedWorker, OrganizationService.method.listWarehouses, {}),
  ]);
  const warehouse = warehouses.find(entry => entry.id === KAZAN_WAREHOUSE_ID);
  if (topology === undefined || warehouse === undefined) {
    throw new Error('Could not find the seeded Kazan warehouse');
  }
  const deliveries = await Promise.all(seeded.map(async (task) => {
    const { deal } = await callReceiving(seedWorker, DealService.method.getDeal, { dealId: task.dealId });
    if (deal === undefined) {
      throw new Error(`Missing the seeded receipt deal ${task.dealId}`);
    }
    return { deal, task };
  }));
  await seedWorker.stop();
  const fixture = await storeSixDockWarehouse(seedPage, topology, warehouse, deliveries);
  await seedPage.close();

  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  scene.watchSceneChunkRequests();
  await createPersonaRobot(page).openAsPersona(warehouseHash, PERSONAS.freshCustomer.id);
  const receipts = page.getByTestId('warehouse-receiving-task');
  const taskCard = (id: string): Locator => receipts.filter({ has: page.locator(`a[href="#/deals/${id}"]`) });
  const dockStatus = (id: string): Locator => taskCard(id).getByTestId('warehouse-receiving-dock');
  await expect(receipts).toHaveCount(6);
  await scene.expectNoCanvas();
  expect(scene.countRequestedSceneChunks()).toBe(0);
  expect(await scene.readDrawFrames()).toBe(0);
  await scene.chooseGraphicsPreference('low');
  await scene.expectSceneState('ready');
  await scene.expectOneCanvas();
  await scene.waitForCameraControls();
  await scene.pressCameraButton('home');

  const workerPage = await context.newPage();
  const worker = await createEngineWorkerRobot(workerPage, DEAL_CUSTOMER);
  try {
    await page.bringToFront();
    const { topology: persisted } = await callReceiving(worker, WarehouseTopologyService.method.getWarehouseTopology, scope);
    const area = persisted?.receivingArea;
    expect([area?.unloadingPoint, ...(area?.additionalUnloadingPoints ?? [])].map(dock => dock?.id)).toEqual(fixture.dockIds);
    const readReceipts = (): Promise<ListReceivingTasksResponse> => callReceiving(worker, method.listReceivingTasks, scope);
    const { tasks: arrivals } = await readReceipts();
    const waiting = arrivals.filter(task => task.unloadingPointId === undefined);
    expect(waiting.map(task => task.id)).toEqual([fixture.frontId, fixture.middleId, fixture.rearId]);
    expect(waiting.map(task => task.yardAdmissionStatus)).toEqual([
      YardAdmissionStatus.WAITING_DOCUMENTS,
      YardAdmissionStatus.WAITING_DOCK,
      YardAdmissionStatus.WAITING_DOCK,
    ]);

    const neighbor = taskCard(fixture.neighborId);
    const neighborScan = await scanDeliveredPallet(neighbor, COTTAGE_SSCC);
    await neighborScan.click();
    await expect(neighbor.getByTestId('warehouse-placement')).toBeVisible();
    await expect(dockStatus(fixture.neighborId)).toContainText('D05');
    await Promise.all([fixture.releaseFarId, fixture.releaseMiddleId].map(async (taskId): Promise<void> => {
      const arrival = arrivals.find(task => task.id === taskId);
      if (arrival === undefined) {
        throw new Error('Missing a seeded dock assignment');
      }
      const { task } = await callReceiving(worker, method.claimReceivingTask, {
        ...scope, expectedVersion: arrival.version, idempotencyKey: randomUUID(), taskId,
      });
      expect(task?.status).toBe(ReceivingTaskStatus.IN_PROGRESS);
    }));

    const canvas = page.getByTestId('scene-viewport').locator('canvas');
    const readCabs = (snapshot: Buffer): Promise<TruckCabPositionValue[]> => readTruckCabPositions(page, snapshot, 35);
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
    const initial = await canvas.screenshot({ path: testInfo.outputPath('warehouse-six-dock-overview.png'), style: CANVAS_ONLY_STYLE });
    const initialCabs = (await readCabs(initial)).toSorted((first, second) => projectCabDepth(first) - projectCabDepth(second));
    expect(initialCabs).toHaveLength(6);
    const [rearParking, middleParking, frontParking] = initialCabs;
    const [d04, d05, d06] = initialCabs.slice(3).toSorted((first, second) => first.x - second.x);
    if (rearParking === undefined || middleParking === undefined || frontParking === undefined
      || d04 === undefined || d05 === undefined || d06 === undefined) {
      throw new Error('Could not identify the three parking spots and the cab positions of D04, D05 and D06');
    }
    const parkingLane = projectCabLane(frontParking);
    const dockAnchors = [d04, d05, d06];
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await scene.waitForIdle();
    const watch = await watchDockHandoff(canvas, d04, d06, rearParking);

    const { tasks: claimed } = await readReceipts();
    const finished = await Promise.all([fixture.releaseFarId, fixture.releaseMiddleId].map(async (taskId) => {
      const task = claimed.find(candidate => candidate.id === taskId);
      if (task === undefined) {
        throw new Error('Missing a claimed blocker');
      }
      return callReceiving(worker, method.finishReceivingTask, {
        ...scope, expectedVersion: task.version, idempotencyKey: randomUUID(), taskId,
      });
    }));
    expect(finished.map(({ task }) => task?.status)).toEqual([
      ReceivingTaskStatus.READY_FOR_RECONCILIATION, ReceivingTaskStatus.READY_FOR_RECONCILIATION,
    ]);
    await expect(dockStatus(fixture.middleId)).toContainText('D04');
    await expect(dockStatus(fixture.rearId)).toContainText('D06');

    let sawRearMoveAfterD04Docked = false;
    let didFrontAndNeighborStay = true;
    let maxCabsOnSharedRoad = 0;
    await expect.poll(async () => {
      const frame = await canvas.screenshot({ style: CANVAS_ONLY_STYLE });
      const cabs = await readCabs(frame);
      const isD04Occupied = hasCabAt(cabs, d04);
      const isD06Occupied = hasCabAt(cabs, d06);
      const isRearParked = hasCabAt(cabs, rearParking);
      const sharedRoadCabs = cabs.filter(cab => !dockAnchors.some(dock => hasCabAt([cab], dock))
        && Math.abs(projectCabLane(cab) - parkingLane) > 2 * CAB_POSITION_TOLERANCE_PX).length;
      maxCabsOnSharedRoad = Math.max(maxCabsOnSharedRoad, sharedRoadCabs);
      didFrontAndNeighborStay &&= hasCabAt(cabs, frontParking) && hasCabAt(cabs, d05);
      const sawD04DockedBeforeRearLeftParking = await watch.evaluate(trace => trace.frame !== undefined);
      if (!sawRearMoveAfterD04Docked && sawD04DockedBeforeRearLeftParking && isD04Occupied && !isD06Occupied && !isRearParked
        && sharedRoadCabs === 1) {
        sawRearMoveAfterD04Docked = true;
        await testInfo.attach('warehouse-six-dock-rear-truck-on-shared-road', { body: frame, contentType: 'image/png' });
      }
      const areBothDocked = isD04Occupied && isD06Occupied && !isRearParked && !hasCabAt(cabs, middleParking) && cabs.length === 4;
      return { areBothDocked, didFrontAndNeighborStay, maxCabsOnSharedRoad, sawD04DockedBeforeRearLeftParking, sawRearMoveAfterD04Docked };
    }, { intervals: [200], message: 'each truck must take the shared road in sequence', timeout: SIX_DOCK_PROMOTIONS_TIMEOUT_MS }).toEqual({
      areBothDocked: true,
      didFrontAndNeighborStay: true,
      maxCabsOnSharedRoad: 1,
      sawD04DockedBeforeRearLeftParking: true,
      sawRearMoveAfterD04Docked: true,
    });
    const handoffFrame = await watch.evaluate((trace) => {
      trace.stop();
      return trace.frame;
    });
    await watch.dispose();
    if (handoffFrame !== undefined) {
      const data = handoffFrame.slice('data:image/png;base64,'.length);
      await testInfo.attach('warehouse-six-dock-middle-arrived-rear-parked', {
        body: Buffer.from(data, 'base64'), contentType: 'image/png',
      });
    }
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
    await canvas.screenshot({ path: testInfo.outputPath('warehouse-six-dock-promotions-settled.png'), style: CANVAS_ONLY_STYLE });

    const { tasks: promoted } = await readReceipts();
    expect(promoted.find(task => task.id === fixture.frontId)?.unloadingPointId).toBeUndefined();
    expect(promoted.find(task => task.id === fixture.middleId)?.unloadingPointId).toBe(fixture.dockIds[3]);
    expect(promoted.find(task => task.id === fixture.rearId)?.unloadingPointId).toBe(fixture.dockIds[5]);
    const rear = taskCard(fixture.rearId);
    const rearScan = await scanDeliveredPallet(rear, '000000000000000031');
    await rearScan.click();
    await expect(rear.getByTestId('warehouse-placement')).toBeVisible();

    const afterDeparture = await expectDockTruckMotion(scene, canvas, async () => {
      const finish = rear.getByTestId('warehouse-finish-receiving');
      await finish.click();
      await expect(finish).toHaveCount(0);
      await expect(neighbor.getByTestId('warehouse-placement')).toBeVisible();
      await expect(dockStatus(fixture.neighborId)).toContainText('D05');
    }, testInfo, 'warehouse-six-dock-rear-truck-exit');
    const remainingCabs = await readCabs(afterDeparture);
    expect(remainingCabs).toHaveLength(3);
    expect([frontParking, d04, d05].every(position => hasCabAt(remainingCabs, position))).toBe(true);
    expect(hasCabAt(remainingCabs, d06)).toBe(false);
    const { tasks: final } = await readReceipts();
    expect(final.find(task => task.id === fixture.rearId)).toMatchObject({ status: ReceivingTaskStatus.READY_FOR_RECONCILIATION });
    expect(final.find(task => task.id === fixture.middleId)?.unloadingPointId).toBe(fixture.dockIds[3]);
    expect(final.find(task => task.id === fixture.neighborId)).toMatchObject({
      receivedUnits: [expect.any(Object)], status: ReceivingTaskStatus.IN_PROGRESS, unloadingPointId: fixture.dockIds[4],
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await scene.expectSceneState('ready');
    await expect(dockStatus(fixture.middleId)).toContainText('D04');
    await expect(dockStatus(fixture.neighborId)).toContainText('D05');
    await scene.waitForCameraControls();
    await scene.pressCameraButton('home');
    await scene.waitForIdle();
    const reducedFrame = await canvas.screenshot({
      path: testInfo.outputPath('warehouse-six-dock-reduced-motion.png'), style: CANVAS_ONLY_STYLE,
    });
    const reducedCabs = await readCabs(reducedFrame);
    expect(reducedCabs).toHaveLength(3);
    expect([frontParking, d04, d05].every(position => hasCabAt(reducedCabs, position))).toBe(true);
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
    expect(scene.readPageErrors()).toEqual([]);
  }
  finally {
    await worker.stop();
    await workerPage.close();
  }
});
