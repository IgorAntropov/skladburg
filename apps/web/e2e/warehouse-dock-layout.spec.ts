import type {
  DescMessage,
  DescMethodUnary,
  MessageInitShape,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  Locator,
  Page,
} from '@playwright/test';
import type { ListReceivingTasksResponse } from '@skladburg/contracts/wms/v1/receiving';
import type { GetWarehouseTopologyResponse } from '@skladburg/contracts/wms/v1/topology';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import {
  WarehouseReceivingService,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import {
  NEW_WAREHOUSE,
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { createCreateWarehouseRobot } from './robots/create-warehouse-robot.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import {
  fundExchangeTrip,
  MINUTE_MS,
  TRIP_ARRIVAL_ADVANCE_MS,
  TRIP_DEPARTURE_ADVANCE_MS,
} from './robots/exchange-trip-journey.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTransportRobot } from './robots/transport-robot.ts';
import {
  CUSTOMER_WAREHOUSE_HASH,
  prepareWarehouseDelivery,
} from './robots/warehouse-delivery-robot.ts';
import {
  openTripPicking,
  scanDeliveredPallet,
  scanPutAwayCell,
  scanTripPallet,
  TRIP_ORIGIN_WAREHOUSE_ID,
} from './robots/warehouse-trip-handoff-robot.ts';

const MOSCOW_WAREHOUSE = { warehouseId: OWN_NETWORK_SITES[0].id };
const IN_TRANSIT_ADVANCE_MS = TRIP_DEPARTURE_ADVANCE_MS + 240 * MINUTE_MS;

const openReceivingLayout = async (page: Page): Promise<void> => {
  const workspace = page.getByTestId('warehouse-workspace');
  await workspace.locator('button[id$="-trigger-layout"]').click();
  await workspace.getByTestId('warehouse-receiving-layout-open').click();
};

const getDock = (page: Page, code: string): Locator => page.getByTestId('warehouse-receiving-layout-dock')
  .and(page.locator(`[data-dock-code="${code}"]`));

const getDockInput = (form: Locator, index: number): Locator => form.getByTestId('warehouse-receiving-layout-dock-entry')
  .nth(index)
  .getByTestId('warehouse-receiving-layout-dock-x')
  .locator('input');

const getColdControl = (form: Locator, index: number): Locator => form.getByTestId('warehouse-receiving-layout-dock-entry')
  .nth(index)
  .getByTestId('warehouse-receiving-layout-dock-cold');

const readFromWorker = async <TInput extends DescMessage, TOutput extends DescMessage>(
  worker: EngineWorkerRobotValue,
  method: DescMethodUnary<TInput, TOutput>,
  request: MessageInitShape<TInput>,
): Promise<MessageShape<TOutput>> => {
  const body = toBinary(method.input, create(method.input, request));

  return fromBinary(method.output, await worker.call(`${method.parent.typeName}/${method.name}`, body));
};

test.use({ hasTouch: true, initialGraphicsPreference: 'off', reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });

test('configures a receiving area and two docks on a new warehouse and restores them after reload', async ({ browserName, page }) => {
  const isPhone = browserName === 'webkit';
  if (isPhone) {
    await page.setViewportSize(PHONE_VIEWPORT);
  }

  const warehouse = createCreateWarehouseRobot(page);
  const navigation = createNavigationRobot(page);
  await navigation.openSection('warehouse');
  await warehouse.openForm();
  await warehouse.fillName();
  await warehouse.selectCity();
  await warehouse.submit();
  await warehouse.expectPanelClosed();
  await page.getByTestId('warehouse-list-item').filter({ hasText: NEW_WAREHOUSE.name }).getByTestId('warehouse-workspace-open').click();

  const workspace = page.getByTestId('warehouse-workspace');
  await workspace.locator('button[id$="-trigger-layout"]').click();
  const setup = workspace.getByTestId('warehouse-layout-initialize');
  await setup.getByTestId('warehouse-layout-zone-z').locator('input').fill('3600');
  await setup.getByTestId('warehouse-layout-initialize-submit').click();
  await workspace.getByTestId('warehouse-receiving-layout-open').click();
  await workspace.getByTestId('warehouse-receiving-layout-edit').click();

  const form = workspace.getByTestId('warehouse-receiving-layout-form');
  await form.getByTestId('warehouse-receiving-layout-x').locator('input').fill('1000');
  await form.getByTestId('warehouse-receiving-layout-z').locator('input').fill('0');
  await form.getByTestId('warehouse-receiving-layout-width').locator('input').fill('7000');
  await form.getByTestId('warehouse-receiving-layout-depth').locator('input').fill('2200');
  await getDockInput(form, 0).fill('2500');
  await form.getByTestId('warehouse-receiving-layout-add-dock').click();
  await getDockInput(form, 1).fill('5500');
  if (!isPhone) {
    await expectNoAxeViolations(page);
  }
  const submit = form.getByTestId('warehouse-receiving-layout-submit');
  if (isPhone) {
    await submit.tap();
  }
  else {
    await submit.click();
  }
  await expect(form).toHaveCount(0);
  await expect(getDock(page, 'D02')).toHaveAttribute('data-x-mm', '5500');

  await navigation.reload();
  await openReceivingLayout(page);
  const footprint = workspace.getByTestId('warehouse-receiving-layout-footprint');
  await expect(footprint).toHaveAttribute('data-x-mm', '1000');
  await expect(footprint).toHaveAttribute('data-z-mm', '0');
  await expect(footprint).toHaveAttribute('data-width-mm', '7000');
  await expect(footprint).toHaveAttribute('data-depth-mm', '2200');
  await expect(getDock(page, 'D01')).toHaveAttribute('data-x-mm', '2500');
  await expect(getDock(page, 'D02')).toHaveAttribute('data-x-mm', '5500');
  await expect(getDock(page, 'D02')).toHaveAttribute('data-z-mm', '0');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('protects the assigned dock until the receiving crew completes its work', async ({ context, page }) => {
  test.setTimeout(120_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const supplierPage = await context.newPage();
  const storePage = await context.newPage();
  const { sscc } = await prepareWarehouseDelivery({ page, storePage, supplierPage });
  const receiving = storePage.getByTestId('warehouse-receiving-task');
  const assignment = receiving.getByTestId('warehouse-receiving-dock');
  await expect(assignment).toContainText('D01');

  await createNavigationRobot(page).openHash(CUSTOMER_WAREHOUSE_HASH);
  await openReceivingLayout(page);
  const originalX = '1000';
  const proposedX = '1500';
  await expect(getDock(page, 'D01')).toHaveAttribute('data-x-mm', originalX);
  await page.getByTestId('warehouse-receiving-layout-edit').click();
  const form = page.getByTestId('warehouse-receiving-layout-form');
  const dockX = getDockInput(form, 0);
  const submit = form.getByTestId('warehouse-receiving-layout-submit');
  await dockX.fill(proposedX);
  await submit.click();
  await expect(page.getByTestId('warehouse-receiving-layout-blocked')).toBeVisible();
  await expect(dockX).toHaveValue(proposedX);
  await expect(assignment).toContainText('D01');

  const submitScan = await scanDeliveredPallet(receiving, sscc);
  await submitScan.click();
  const placement = receiving.getByTestId('warehouse-placement');
  await expect(placement).toBeVisible();
  await expect(assignment).toContainText('D01');
  const finish = receiving.getByTestId('warehouse-finish-receiving');
  await finish.click();
  await expect(finish).toHaveCount(0);
  const cellCode = await scanPutAwayCell(placement);
  await placement.getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(0);
  await expect(receiving).toContainText(cellCode);

  await openReceivingLayout(storePage);
  await expect(getDock(storePage, 'D01')).toHaveAttribute('data-x-mm', originalX);
  await submit.click();
  await expect(form).toHaveCount(0);
  await expect(getDock(page, 'D01')).toHaveAttribute('data-x-mm', proposedX);
  await expect(getDock(storePage, 'D01')).toHaveAttribute('data-x-mm', proposedX);
});

test('assigns a waiting refrigerated truck to a newly configured cold dock', async ({ context, page }) => {
  test.setTimeout(150_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const customer = createPersonaRobot(page);
  const navigation = createNavigationRobot(page);
  await customer.openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await openReceivingLayout(page);
  const edit = page.getByTestId('warehouse-receiving-layout-edit');
  const form = page.getByTestId('warehouse-receiving-layout-form');
  const submit = form.getByTestId('warehouse-receiving-layout-submit');
  await edit.click();
  const oldColdControl = getColdControl(form, 0);
  await expect(oldColdControl.locator('input')).toBeChecked();
  await oldColdControl.click();
  await expect(oldColdControl.locator('input')).not.toBeChecked();
  await submit.click();
  await expect(form).toHaveCount(0);

  const { advanceClock, carrierPage, shipTrip, supplierPage } = await fundExchangeTrip({
    context,
    kind: VehicleCargoKind.TEMPERATURE_CONTROLLED,
    originWarehouseId: TRIP_ORIGIN_WAREHOUSE_ID,
    page,
    shipperSide: 'customer',
  });
  const picking = await openTripPicking(supplierPage);
  const { confirmPicking, confirmShipment } = await scanTripPallet(picking);
  await confirmPicking();
  await shipTrip(confirmShipment);

  const carrier = createTransportRobot(carrierPage);
  await advanceClock(IN_TRANSIT_ADVANCE_MS);
  await carrier.expectTripStatus(TripStatus.IN_TRANSIT);
  await advanceClock(TRIP_ARRIVAL_ADVANCE_MS);
  await carrier.expectTripStatus(TripStatus.ARRIVED);

  const storePage = await context.newPage();
  await createPersonaRobot(storePage).openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshStorekeeper.id);
  const receiving = storePage.getByTestId('warehouse-receiving-task');
  const assignment = receiving.getByTestId('warehouse-receiving-dock');
  const enterSscc = receiving.getByTestId('warehouse-enter-sscc');
  const claim = receiving.getByTestId('warehouse-claim-receiving');
  await expect(assignment).toBeVisible();
  const carrierTitle = carrierPage.getByTestId('transport-carrier-title-submit');
  await carrierTitle.click();
  await expect(carrierTitle).toHaveCount(0);

  const workerPage = await context.newPage();
  const worker = await createEngineWorkerRobot(workerPage, DEAL_CUSTOMER);
  try {
    const readTopology = (): Promise<GetWarehouseTopologyResponse> =>
      readFromWorker(worker, WarehouseTopologyService.method.getWarehouseTopology, MOSCOW_WAREHOUSE);
    const readReceipts = (): Promise<ListReceivingTasksResponse> =>
      readFromWorker(worker, WarehouseReceivingService.method.listReceivingTasks, MOSCOW_WAREHOUSE);
    const { tasks } = await readReceipts();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCK);
    expect(tasks[0]?.unloadingPointId).toBeUndefined();
    await expect(receiving.getByTestId('yard-waiting-reason')).toHaveAttribute('data-reason', 'NO_COMPATIBLE_DOCK');
    await claim.click();
    await expect(claim).toHaveCount(0);
    await expect(enterSscc).toHaveCount(0);

    const before = await readTopology();
    const originalDock = before.topology?.receivingArea?.unloadingPoint;
    expect(originalDock).toMatchObject({ code: 'D01', position: { xMm: 1000, zMm: 0 } });
    await navigation.openHash(CUSTOMER_WAREHOUSE_HASH);
    await openReceivingLayout(page);
    await edit.click();
    await form.getByTestId('warehouse-receiving-layout-z').locator('input').fill('2100');
    await form.getByTestId('warehouse-receiving-layout-width').locator('input').fill('7500');
    await form.getByTestId('warehouse-receiving-layout-depth').locator('input').fill('2000');
    await form.getByTestId('warehouse-receiving-layout-add-dock').click();
    await getDockInput(form, 1).fill('7200');
    await getColdControl(form, 1).click();
    await submit.click();
    await expect(form).toHaveCount(0);
    await expect(getDock(page, 'D02')).toHaveAttribute('data-x-mm', '7200');
    await expect(assignment).toContainText('D02');
    await expect(enterSscc).toBeVisible();

    const after = await readTopology();
    expect(after.topology?.receivingArea?.unloadingPoint).toEqual(originalDock);
    const added = after.topology?.receivingArea?.additionalUnloadingPoints[0];
    expect(added).toMatchObject({
      capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD], code: 'D02', id: expect.any(String),
    });
    expect((await readReceipts()).tasks).toMatchObject([{
      id: tasks[0]?.id, unloadingPointId: added?.id, yardAdmissionStatus: YardAdmissionStatus.ADMITTED,
    }]);
  }
  finally {
    await worker.stop();
    await workerPage.close();
  }
});
