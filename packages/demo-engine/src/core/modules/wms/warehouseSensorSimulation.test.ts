import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  type WarehouseSensorChannel,
  WarehouseSensorChannelKind,
} from '@skladburg/contracts/wms/v1/warehouse_sensors';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { SEED_WORLD_START_MS } from '../../seed/seedConfig';
import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import { readWarehouseSensors } from './warehouseSensorSimulation';

const MINUTE_MS = 60_000;
const topology = createSeedWarehouseTopology({
  prefix: '8f000004',
  tenantId: SeedOrganizationId.CUSTOMER_1,
  warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3,
});
const readChannels = (minute: number): WarehouseSensorChannel[] =>
  readWarehouseSensors(topology, SEED_WORLD_START_MS + minute * MINUTE_MS)[0]?.channels ?? [];

describe('warehouse sensor simulation', () => {
  it('keeps devices attached to the original tenant, warehouse and persistent zone ID', () => {
    const renamed = topology.storageZones.map(zone => ({ ...zone, code: 'Z02' }));
    const devices = readWarehouseSensors({ ...topology, storageZones: renamed }, SEED_WORLD_START_MS);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.zoneId).toBe(renamed[0]?.id);
    expect(readWarehouseSensors({ ...topology, tenantId: SeedOrganizationId.SUPPLIER_1 }, SEED_WORLD_START_MS)).toEqual([]);
    expect(readWarehouseSensors({ ...topology, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 }, SEED_WORLD_START_MS)).toEqual([]);
    const replaced = topology.storageZones.map(zone => ({ ...zone, id: '31000000-0000-4000-8000-000000000001' }));
    expect(readWarehouseSensors({ ...topology, storageZones: replaced }, SEED_WORLD_START_MS)).toEqual([]);
  });

  it('starts all four channels at installation and appends on the world-minute boundary', () => {
    const early = readWarehouseSensors(topology, SEED_WORLD_START_MS - 1)[0]?.channels;
    expect(early?.map(channel => channel.readings)).toEqual([[], [], [], []]);
    const first = readChannels(0);
    const justBeforeNext = readWarehouseSensors(topology, SEED_WORLD_START_MS + MINUTE_MS - 1);
    expect(justBeforeNext[0]?.channels).toEqual(first);
    const next = readChannels(1);
    expect(new Set(next.map(channel => channel.id)).size).toBe(4);
    expect(next.map(channel => channel.id)).toEqual(first.map(channel => channel.id));
    for (const channel of next) {
      expect(channel.readings.map(reading => reading.measuredAt)).toEqual([
        timestampFromMs(SEED_WORLD_START_MS),
        timestampFromMs(SEED_WORLD_START_MS + MINUTE_MS),
      ]);
    }
  });

  it('repeats the door opening, warming and recovery with each measurement in the channel unit', () => {
    const channels = readChannels(12);
    const values = (kind: WarehouseSensorChannelKind): undefined | WarehouseSensorChannel['readings'][number]['value'][] =>
      channels.find(channel => channel.kind === kind)?.readings.map(reading => reading.value);
    expect(values(WarehouseSensorChannelKind.TEMPERATURE)).toEqual(
      [40, 40, 55, 70, 85, 100, 85, 70, 55, 40, 40, 40, 40].map(value => ({ case: 'deciCelsius', value })),
    );
    expect(values(WarehouseSensorChannelKind.DOOR)).toEqual(
      [false, true, true, true, true, false, false, false, false, false, false, false, false].map(value => ({ case: 'doorOpen', value })),
    );
    expect(values(WarehouseSensorChannelKind.HUMIDITY)?.[5]).toEqual({ case: 'relativeHumidityPercent', value: 80 });
    expect(values(WarehouseSensorChannelKind.CO2)?.[5]).toEqual({ case: 'co2Ppm', value: 480 });
  });

  it('returns the same most recent 60 ordered samples after jumping many cycles', () => {
    const lastMinute = 12_000_000;
    const channels = readChannels(lastMinute);
    const next = readChannels(lastMinute + 1);
    expect(readChannels(lastMinute)).toEqual(channels);
    for (const channel of channels) {
      expect(channel.readings).toHaveLength(60);
      expect(channel.readings[0]?.measuredAt).toEqual(timestampFromMs(SEED_WORLD_START_MS + (lastMinute - 59) * MINUTE_MS));
      expect(channel.readings.at(-1)?.measuredAt).toEqual(timestampFromMs(SEED_WORLD_START_MS + lastMinute * MINUTE_MS));
      expect(next.find(entry => entry.id === channel.id)?.readings.slice(0, -1)).toEqual(channel.readings.slice(1));
    }
  });
});
