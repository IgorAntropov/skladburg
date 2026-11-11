import type { Page } from '@playwright/test';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  type Driver,
  ListCarrierLanesRequestSchema,
  ListCarrierLanesResponseSchema,
  ListDriversRequestSchema,
  ListDriversResponseSchema,
  ListVehiclesRequestSchema,
  ListVehiclesResponseSchema,
  SaveDriverRequestSchema,
  SaveDriverResponseSchema,
  VehicleBodyType,
} from '@skladburg/contracts/fleet/v1/fleet';
import {
  GetImportJobRequestSchema,
  GetImportJobResponseSchema,
  PreviewImportRequestSchema,
  PreviewImportResponseSchema,
} from '@skladburg/contracts/import/v1/import';
import {
  GetWarehouseTopologyRequestSchema,
  GetWarehouseTopologyResponseSchema,
} from '@skladburg/contracts/wms/v1/topology';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  EngineWorkerRobotValue,
  WorkerActingContextValue,
} from './robots/engine-worker-robot.ts';

import { FOREIGN_NETWORK_SITE } from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import {
  changeStoredEngineMetadata,
  readStoredEngineSnapshot,
  recreatePreFleetEngineDatabase,
} from './robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';

const SEED_REQUEST = '**/assets/seedSnapshot-*.js';
const DEAL_HISTORY_REQUEST = '**/assets/seedDealHistory-*.js';
const FRESH_CARRIER: WorkerActingContextValue = {
  organizationId: '10000004-0000-4000-8000-000000000000',
  userId: '20000004-0000-4000-8000-000000000000',
};
const PRESERVED_STORES = ['deals', 'documents', 'payments', 'importJobs'] as const;

const createStoredImport = async (page: Page): Promise<string> => {
  const worker = await createEngineWorkerRobot(page);

  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(worker.hasRequestedChunk('seedSnapshot')).toBe(true);
    expect(worker.hasRequestedChunk('seedDealHistory')).toBe(true);
    expect(worker.hasRequestedChunk('importService')).toBe(false);
    const response = fromBinary(PreviewImportResponseSchema, await worker.call('import.v1.ImportService/PreviewImport',
      toBinary(PreviewImportRequestSchema, create(PreviewImportRequestSchema, {
        fileBytes: readFileSync(new URL('./fixtures/catalog-import.csv', import.meta.url)),
        fileName: 'catalog.csv',
        idempotencyKey: randomUUID(),
        templateId: 'catalog',
      })),
    ));
    expect(worker.hasRequestedChunk('importService')).toBe(true);
    expect(response.job?.errorCount).toBe(0);

    if (response.job === undefined) {
      throw new Error('Preview must persist the import job');
    }

    return response.job.id;
  }
  finally {
    await worker.stop();
  }
};

const expectStoredImport = async (worker: EngineWorkerRobotValue, jobId: string): Promise<void> => {
  const response = fromBinary(GetImportJobResponseSchema, await worker.call('import.v1.ImportService/GetImportJob',
    toBinary(GetImportJobRequestSchema, create(GetImportJobRequestSchema, { jobId })),
  ));
  expect(response.job?.id).toBe(jobId);
  expect(response.rows).toHaveLength(1);
};

const listDrivers = async (worker: EngineWorkerRobotValue): Promise<Driver[]> => {
  const response = fromBinary(ListDriversResponseSchema, await worker.call('fleet.v1.FleetService/ListDrivers',
    toBinary(ListDriversRequestSchema, create(ListDriversRequestSchema)),
  ));
  return response.drivers;
};

test('migrates a saved world to fleet storage and restores an edited driver after restart', async ({ page }) => {
  await createStoredImport(page);
  const savedRecords = await readStoredEngineSnapshot(page, PRESERVED_STORES);
  await recreatePreFleetEngineDatabase(page);
  await page.context().route(SEED_REQUEST, route => route.abort('failed'));
  await page.context().route(DEAL_HISTORY_REQUEST, route => route.abort('failed'));

  const migrated = await createEngineWorkerRobot(page, FRESH_CARRIER);
  let editedDriver: Driver;
  try {
    await expect.poll(migrated.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(await readStoredEngineSnapshot(page, PRESERVED_STORES)).toBe(savedRecords);
    const metadata: unknown = JSON.parse(await readStoredEngineSnapshot(page, ['meta']));
    expect(metadata).toEqual([['meta', ['engineMeta', 'schemaVersion'], [expect.any(Object), 21]]]);
    expect(migrated.hasRequestedChunk('fleet')).toBe(false);

    const { vehicles } = fromBinary(ListVehiclesResponseSchema, await migrated.call('fleet.v1.FleetService/ListVehicles',
      toBinary(ListVehiclesRequestSchema, create(ListVehiclesRequestSchema)),
    ));
    expect(migrated.hasRequestedChunk('fleet')).toBe(true);
    expect(vehicles).toEqual(expect.arrayContaining([
      expect.objectContaining({ details: expect.objectContaining({ bodyType: VehicleBodyType.REFRIGERATED }) }),
    ]));
    expect(vehicles.map(vehicle => vehicle.tenantId)).toEqual(vehicles.map(() => FRESH_CARRIER.organizationId));

    const { carrierLanes } = fromBinary(ListCarrierLanesResponseSchema, await migrated.call('fleet.v1.FleetService/ListCarrierLanes',
      toBinary(ListCarrierLanesRequestSchema, create(ListCarrierLanesRequestSchema)),
    ));
    expect(carrierLanes.length).toBeGreaterThan(0);

    const [driver] = await listDrivers(migrated);
    if (driver === undefined) {
      throw new Error('The migrated fleet must contain a driver');
    }
    const saved = fromBinary(SaveDriverResponseSchema, await migrated.call('fleet.v1.FleetService/SaveDriver',
      toBinary(SaveDriverRequestSchema, create(SaveDriverRequestSchema, {
        displayName: 'Илья Пригородный',
        driverId: driver.id,
        expectedVersion: driver.version,
        idempotencyKey: randomUUID(),
        isActive: false,
      })),
    )).driver;
    if (saved === undefined) {
      throw new Error('The fleet command must return the saved driver');
    }
    editedDriver = saved;
    expect(editedDriver).toMatchObject({
      displayName: 'Илья Пригородный',
      id: driver.id,
      isActive: false,
      version: driver.version + 1n,
    });
  }
  finally {
    await migrated.stop();
  }

  const restored = await createEngineWorkerRobot(page, FRESH_CARRIER);
  try {
    await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(await readStoredEngineSnapshot(page, PRESERVED_STORES)).toBe(savedRecords);
    expect((await listDrivers(restored)).find(driver => driver.id === editedDriver.id)).toEqual(editedDriver);
  }
  finally {
    await restored.stop();
  }
});

test('loads the seed for a fresh world and restores saved changes without the seed chunk', async ({ page }) => {
  const jobId = await createStoredImport(page);
  await page.context().route(SEED_REQUEST, route => route.abort('failed'));
  await page.context().route(DEAL_HISTORY_REQUEST, route => route.abort('failed'));
  const restored = await createEngineWorkerRobot(page);

  try {
    await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await expectStoredImport(restored, jobId);
    expect(restored.hasRequestedChunk('seedSnapshot')).toBe(false);
    expect(restored.hasRequestedChunk('seedDealHistory')).toBe(false);
    expect(restored.hasRequestedChunk('warehouseTopologyService')).toBe(false);
    const warehouseId = FOREIGN_NETWORK_SITE.id;
    const { topology } = fromBinary(GetWarehouseTopologyResponseSchema, await restored.call(
      'wms.v1.WarehouseTopologyService/GetWarehouseTopology',
      toBinary(GetWarehouseTopologyRequestSchema, create(GetWarehouseTopologyRequestSchema, { warehouseId })),
    ));
    expect(topology).toMatchObject({ revision: 1, warehouseId });
    expect(restored.hasRequestedChunk('warehouseTopologyService')).toBe(true);
  }
  finally {
    await restored.stop();
  }
});

test('preserves an obsolete world when the seed chunk fails and recovers after restarting the Worker', async ({ page }) => {
  await createStoredImport(page);
  await changeStoredEngineMetadata(page, { isClockPaused: true, seedVersionOffset: -1 });
  const snapshot = await readStoredEngineSnapshot(page);
  await page.context().route(SEED_REQUEST, route => route.abort('failed'));
  const failed = await createEngineWorkerRobot(page);

  try {
    await expect.poll(failed.readStartup).toEqual({ kind: 'unavailable' });
    expect(failed.hasRequestedChunk('seedSnapshot')).toBe(true);
    expect(await readStoredEngineSnapshot(page)).toBe(snapshot);
  }
  finally {
    await failed.stop();
  }

  await page.context().unroute(SEED_REQUEST);
  const recovered = await createEngineWorkerRobot(page);

  try {
    await expect.poll(recovered.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(recovered.hasRequestedChunk('seedSnapshot')).toBe(true);
    expect(await readStoredEngineSnapshot(page)).not.toBe(snapshot);
  }
  finally {
    await recovered.stop();
  }
});

test('keeps the restored world and epoch on a failed reset and retries in the same Worker', async ({ page }) => {
  const jobId = await createStoredImport(page);
  await changeStoredEngineMetadata(page, { isClockPaused: true, seedVersionOffset: 0 });
  await page.context().route(SEED_REQUEST, route => route.abort('failed'));
  const restored = await createEngineWorkerRobot(page);

  try {
    await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    const status = await restored.readStartup();
    const snapshot = await readStoredEngineSnapshot(page);
    expect(restored.hasRequestedChunk('seedSnapshot')).toBe(false);
    expect(await restored.reset()).toBe('transport_error');
    expect(restored.hasRequestedChunk('seedSnapshot')).toBe(true);
    expect(await restored.readStartup()).toEqual(status);
    expect(await restored.hasReset()).toBe(false);
    expect(await readStoredEngineSnapshot(page)).toBe(snapshot);
    await expectStoredImport(restored, jobId);

    await page.context().unroute(SEED_REQUEST);
    expect(await restored.reset()).toBe('control_result');
    expect(await restored.hasReset()).toBe(true);
    expect(await restored.readStartup()).not.toEqual(status);
  }
  finally {
    await restored.stop();
  }
});
