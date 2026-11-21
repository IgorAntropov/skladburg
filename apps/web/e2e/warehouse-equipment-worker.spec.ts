import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import { warehouseChannel } from '@skladburg/contracts/runtime';
import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';
import {
  type GetWarehouseEquipmentResponse,
  WarehouseEquipmentService,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WAREHOUSE_YARD_MORNING } from '@skladburg/demo-engine/client';
import { randomUUID } from 'node:crypto';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';

import { OWN_NETWORK_SITES } from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { changeStoredEngineMetadata } from './robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';

const SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };
const DRIVER = { ...DEAL_CUSTOMER, userId: '20000032-0000-4000-8000-000000000000' };

test('notifies another tab when a driver claims the forklift', async ({ context, page }) => {
  const observer = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  const driver = await createEngineWorkerRobot(await context.newPage(), DRIVER);
  try {
    await expect.poll(observer.readStartup).toMatchObject({ kind: 'ready' });
    await expect.poll(driver.readStartup).toMatchObject({ kind: 'ready' });
    const channel = warehouseChannel(SCOPE.warehouseId);
    const subscription = await observer.subscribe(channel);
    expect(subscription.kind).toBe('subscribed');
    const { tasks } = await callYardWorker(driver, WarehouseReceivingService.method.listReceivingTasks, SCOPE);
    const task = tasks.find(receipt => receipt.requiredQualifications.includes(WarehouseStaffQualificationKind.FORKLIFT));
    if (task === undefined) {
      throw new Error('Missing receiving task with a forklift requirement');
    }
    await callYardWorker(driver, WarehouseReceivingService.method.claimReceivingTask, {
      ...SCOPE, expectedVersion: task.version, idempotencyKey: randomUUID(), taskId: task.id,
    });
    await expect.poll(async () => (await observer.readEvents(subscription.id))
      .filter(event => event.payload.case === 'warehouseEquipmentChanged'))
      .toMatchObject([{ channel, payload: { value: SCOPE } }]);
    const { equipment } = await callYardWorker(observer, WarehouseEquipmentService.method.getWarehouseEquipment, SCOPE);
    expect(equipment.filter(unit => unit.taskId === task.id)).toMatchObject([{
      driverStaffId: DRIVER.userId,
      status: WarehouseEquipmentStatus.TO_TASK,
    }]);
  }
  finally {
    await driver.stop();
    await observer.stop();
  }
});

test('restores the occupied charging station and releases the morning forklift at full charge', async ({ page }) => {
  const openMorning = (): Promise<EngineWorkerRobotValue> => createEngineWorkerRobot(page, DEAL_CUSTOMER, './', WAREHOUSE_YARD_MORNING);
  const readFleet = (worker: EngineWorkerRobotValue): Promise<GetWarehouseEquipmentResponse> =>
    callYardWorker(worker, WarehouseEquipmentService.method.getWarehouseEquipment, SCOPE);
  let worker = await openMorning();
  let occupiedStationId: string;
  let chargingUnitId: string;
  let startedAtMs: number;
  let initialBattery: number;

  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await expect.poll(async () => (await readFleet(worker)).equipment.filter(unit => unit.status === WarehouseEquipmentStatus.CHARGING))
      .toHaveLength(1);
    const { equipment, stations } = await readFleet(worker);
    const charging = equipment.find(unit => unit.status === WarehouseEquipmentStatus.CHARGING);
    const station = stations[0];
    const { worldTime } = await callYardWorker(worker, ClockService.method.getWorldClock, {});
    if (charging === undefined || station === undefined || worldTime === undefined) {
      throw new Error('Expected a forklift charging at the morning yard station');
    }
    expect(equipment).toHaveLength(2);
    expect(stations).toHaveLength(1);
    expect(station.equipmentId).toBe(charging.id);
    expect(charging.chargingStationId).toBe(station.id);
    expect(charging.batteryPercent).toBeLessThan(20);
    occupiedStationId = station.id;
    chargingUnitId = charging.id;
    initialBattery = charging.batteryPercent;
    startedAtMs = timestampMs(worldTime);
  }
  finally {
    await worker.stop();
  }

  const setMorningTime = (minutes: number): Promise<void> => changeStoredEngineMetadata(page, {
    demoScenario: WAREHOUSE_YARD_MORNING,
    isClockPaused: true,
    seedVersionOffset: 0,
    worldTimeMs: startedAtMs + minutes * 60_000,
  });
  await setMorningTime(10);
  worker = await openMorning();
  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await expect.poll(async () => (await readFleet(worker)).equipment.find(unit => unit.id === chargingUnitId)?.batteryPercent)
      .toBeGreaterThan(initialBattery);
    const { equipment, stations } = await readFleet(worker);
    expect(stations).toEqual([expect.objectContaining({ equipmentId: chargingUnitId, id: occupiedStationId })]);
    expect(equipment.find(unit => unit.id === chargingUnitId)).toMatchObject({
      chargingStationId: occupiedStationId, status: WarehouseEquipmentStatus.CHARGING,
    });
  }
  finally {
    await worker.stop();
  }

  await setMorningTime(120);
  worker = await openMorning();
  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await expect.poll(async () => (await readFleet(worker)).equipment.find(unit => unit.id === chargingUnitId))
      .toMatchObject({ batteryPercent: 100, status: WarehouseEquipmentStatus.AVAILABLE });
    const { equipment, stations } = await readFleet(worker);
    expect(equipment.find(unit => unit.id === chargingUnitId)?.chargingStationId).toBeUndefined();
    expect(stations.map(station => station.equipmentId)).toEqual([undefined]);
  }
  finally {
    await worker.stop();
  }
});
