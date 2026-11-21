import type { WarehouseSensorAlert } from '@skladburg/contracts/common/v1/warehouse_sensor_alert';

import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  WarehouseSensorChannelKind,
  WarehouseSensorService,
} from '@skladburg/contracts/wms/v1/warehouse_sensors';
import {
  expect,
  it,
} from 'vitest';

import type { IDemoEngine } from '../../engine/engineTypes';
import type { EngineSnapshotValue } from '../../ports/index';

import { createEngineWithTasks } from '../../engine/createEngine';
import {
  createEngineTransport,
  createFakeRealTime,
  createSpyStorage,
} from '../../engine/testing/engineHarness';
import {
  createSeedSnapshot,
  SeedUserId,
} from '../../seed/index';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import {
  WAREHOUSE_SENSOR_INTERVAL_MS,
  WAREHOUSE_SENSOR_SITE,
} from '../../seed/warehouseSensorConfig';
import { TABLE_DEFINITIONS } from '../../state/index';
import { callAs } from '../testing/moduleHarness';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const { installedAtMs, tenantId, warehouseId } = WAREHOUSE_SENSOR_SITE;

const pausedWorld = (sample: number): EngineSnapshotValue => {
  const snapshot = createSeedSnapshot();
  const topology = encodeWarehouseTopology(createSeedWarehouseTopology({ prefix: '8f000004', tenantId, warehouseId }));
  const warehouseTopologies = new Map(snapshot.collections.warehouseTopologies);
  warehouseTopologies.set(warehouseId, TABLE_DEFINITIONS.warehouseTopologies.encode(topology));
  return {
    ...snapshot,
    collections: { ...snapshot.collections, warehouseTopologies },
    meta: { ...snapshot.meta, timeScale: 0, worldTimeMs: installedAtMs + sample * WAREHOUSE_SENSOR_INTERVAL_MS },
  };
};

const readTemperatureAlert = async (engine: IDemoEngine): Promise<undefined | WarehouseSensorAlert> => {
  const service = createClient(WarehouseSensorService, createEngineTransport(engine, true));
  const { devices } = await service.getWarehouseSensors({ warehouseId }, callAs(SeedUserId.ADMIN_1, tenantId));
  return devices[0]?.channels.find(channel => channel.kind === WarehouseSensorChannelKind.TEMPERATURE)?.alert;
};

it('preserves a paused saved world on a failed sensor startup and resumes the confirmed episode without duplicates', async () => {
  const snapshot = pausedWorld(5);
  const storage = createSpyStorage(snapshot);
  const options = { epoch: 'sensor-start', realTime: createFakeRealTime(), storage };
  storage.failNextCommit();
  await expect(createEngineWithTasks(options, () => [])).rejects.toMatchObject({ name: 'SeedLoadError' });
  expect(await storage.load()).toEqual(snapshot);
  const engine = await createEngineWithTasks(options, () => []);
  const opened = await readTemperatureAlert(engine);
  expect(opened?.openedAt).toEqual(timestampFromMs(installedAtMs + 4 * WAREHOUSE_SENSOR_INTERVAL_MS));
  const saved = await storage.load();
  const reopened = await createEngineWithTasks(options, () => []);
  expect(await readTemperatureAlert(reopened)).toEqual(opened);
  expect(await storage.load()).toEqual(saved);
});

it('completes a reset once the new world is stored and retries sensor initialization on the next tick', async () => {
  const seed = pausedWorld(0);
  const storage = createSpyStorage(pausedWorld(5));
  const options = { epoch: 'sensor-reset', realTime: createFakeRealTime(), storage };
  const engine = await createEngineWithTasks(options, () => [], () => Promise.resolve(seed));
  expect((await readTemperatureAlert(engine))?.id).toBeTruthy();
  storage.failNextCommit();
  await engine.reset('after-reset');
  expect(engine.epoch()).toBe('after-reset');
  expect(await readTemperatureAlert(engine)).toBeUndefined();
  expect(await storage.load()).toEqual(seed);
  await expect(engine.tick()).rejects.toThrow();
  await engine.tick();
  expect((await storage.load())?.collections.warehouseSensorAlerts.size).toBe(1);
});

it('confirms a complete excursion when the first scheduled tick after reset arrives late', async () => {
  const initial = pausedWorld(0);
  const seed = { ...initial, meta: { ...initial.meta, timeScale: 1 } };
  const realTime = createFakeRealTime();
  const storage = createSpyStorage(seed);
  const options = { epoch: 'sensor-reset', realTime, storage };
  const engine = await createEngineWithTasks(options, () => [], () => Promise.resolve(seed));
  await engine.reset('world-after-reset');
  realTime.advance(8 * WAREHOUSE_SENSOR_INTERVAL_MS);
  await engine.tick();
  expect(await readTemperatureAlert(engine)).toMatchObject({
    openedAt: timestampFromMs(installedAtMs + 4 * WAREHOUSE_SENSOR_INTERVAL_MS),
    resolvedAt: timestampFromMs(installedAtMs + 7 * WAREHOUSE_SENSOR_INTERVAL_MS),
  });
});
