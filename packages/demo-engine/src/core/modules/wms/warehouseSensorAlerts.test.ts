import type { WarehouseSensorAlert } from '@skladburg/contracts/common/v1/warehouse_sensor_alert';

import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  expect,
  it,
  vi,
} from 'vitest';

import { createWarehouseSensorAlertRefresh } from '../../engine/refreshWarehouseSensorAlerts';
import { SeedUserId } from '../../seed/seedIds';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import {
  WAREHOUSE_SENSOR_INTERVAL_MS,
  WAREHOUSE_SENSOR_SITE,
} from '../../seed/warehouseSensorConfig';
import {
  createTestRuntime,
  type TestRuntimeValue,
} from '../testing/testRuntime';
import { readConfirmedSensorAlert } from './warehouseSensorAlerts';
import * as simulation from './warehouseSensorSimulation';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const { installedAtMs, tenantId, warehouseId, zoneId } = WAREHOUSE_SENSOR_SITE;
const timeAt = (minute: number): number => installedAtMs + minute * WAREHOUSE_SENSOR_INTERVAL_MS;
const stamp = (minute: number): ReturnType<typeof timestampFromMs> => timestampFromMs(timeAt(minute));

interface SensorHarnessValue extends TestRuntimeValue {
  notices: () => WarehouseSensorAlert[];
  readAlert: () => undefined | WarehouseSensorAlert;
  tick: (minute: number) => Promise<void>;
}

const setup = async (initialSample = 0): Promise<SensorHarnessValue> => {
  const harness = createTestRuntime();
  const { clock, runtime } = harness;
  const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId, warehouseId });
  await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
  });
  const now = vi.spyOn(clock, 'now').mockReturnValue(timeAt(initialSample));
  const refresh = createWarehouseSensorAlertRefresh(runtime, true);
  const tick = async (minute: number): Promise<void> => {
    now.mockReturnValue(timeAt(minute));
    await refresh();
  };
  const readAlert = (): undefined | WarehouseSensorAlert => {
    const [record] = runtime.read.list('warehouseSensorAlerts');
    return readConfirmedSensorAlert(runtime.errors, record, tenantId, warehouseId, zoneId);
  };
  const notices = (): WarehouseSensorAlert[] =>
    runtime.read.listBy('notifications', 'userId', SeedUserId.ADMIN_1).flatMap(({ notification }) =>
      notification.params.case === 'warehouseSensorAlert' ? [notification.params.value] : []);

  return { ...harness, notices, readAlert, tick };
};

it('commits a single episode and its notifications together and retries a rejected sample in the same minute', async () => {
  const { events, notices, readAlert, storage, tick } = await setup();
  await tick(3);
  vi.spyOn(storage, 'commit').mockRejectedValueOnce(new Error('write failed'));
  await expect(tick(4)).rejects.toThrow();
  expect(readAlert()).toBeUndefined();
  expect(notices()).toEqual([]);
  expect(events).toHaveLength(0);

  await tick(4);
  const opened = readAlert();
  expect(opened).toMatchObject({ openedAt: stamp(4), openedDeciCelsius: 85, thresholdDeciCelsius: 80 });
  await tick(5);
  await tick(6);
  expect(readAlert()).toEqual(opened);
  expect(notices()).toEqual([opened]);
  await tick(7);
  const closed = readAlert();
  expect(closed).toMatchObject({ id: opened?.id, openedAt: stamp(4), resolvedAt: stamp(7), resolvedDeciCelsius: 70 });
  await tick(7);
  expect(notices()).toEqual([closed]);
  expect(events.filter(event => event.payload.case === 'warehouseSensorAlertsChanged')).toHaveLength(2);
});

it('keeps equality normal and closes at exactly the threshold', async () => {
  const { readAlert, tick } = await setup();
  const actual = simulation.readSensorDeciCelsius;
  const profile = vi.spyOn(simulation, 'readSensorDeciCelsius').mockImplementation(
    sample => sample === 4 || sample === 6 ? 80 : actual(sample),
  );
  try {
    await tick(3);
    await tick(4);
    expect(readAlert()).toBeUndefined();
    await tick(5);
    expect(readAlert()?.openedAt).toEqual(stamp(5));
    await tick(6);
    expect(readAlert()).toMatchObject({ resolvedAt: stamp(6), resolvedDeciCelsius: 80 });
  }
  finally {
    profile.mockRestore();
  }
});

it('uses the actual start for an ongoing episode on first opening an older paused world', async () => {
  const active = await setup(1_200_005);
  await active.tick(1_200_005);
  expect(active.readAlert()?.openedAt).toEqual(stamp(1_200_004));
  expect(active.readAlert()?.resolvedAt).toBeUndefined();
  expect(active.notices()).toHaveLength(1);
  const normal = await setup(1_200_010);
  await normal.tick(1_200_010);
  expect(normal.readAlert()).toBeUndefined();
  expect(normal.notices()).toHaveLength(0);
});

it('closes the previous episode at its first recovery and replays only the most recent hour after a large jump', async () => {
  const { notices, readAlert, tick } = await setup();
  await tick(4);
  const previous = readAlert();
  await tick(1_200_005);
  const history = notices();
  expect(history.find(alert => alert.id === previous?.id)).toMatchObject({ openedAt: stamp(4), resolvedAt: stamp(7) });
  expect(readAlert()?.openedAt).toEqual(stamp(1_200_004));
  expect(readAlert()?.resolvedAt).toBeUndefined();
  expect(readAlert()?.id).not.toBe(previous?.id);
  expect(history).toHaveLength(7);
  await tick(1_200_005);
  expect(notices()).toEqual(history);
});
