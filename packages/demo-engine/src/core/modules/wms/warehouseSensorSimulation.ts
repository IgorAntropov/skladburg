import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  WarehouseSensorChannelKind,
  type WarehouseSensorDevice,
  WarehouseSensorDeviceSchema,
  type WarehouseSensorReading,
  WarehouseSensorReadingSchema,
} from '@skladburg/contracts/wms/v1/warehouse_sensors';

import { SEED_WAREHOUSE_SENSORS } from '../../seed/seedWarehouseSensors';

const SAMPLE_INTERVAL_MS = 60_000;
const MAX_READINGS_PER_CHANNEL = 60;
const CYCLE_MINUTES = 12;

type SimulatedChannelKindValue = typeof SEED_WAREHOUSE_SENSORS[number]['channels'][number]['kind'];

const readSampleValue = (kind: SimulatedChannelKindValue, sample: number): WarehouseSensorReading['value'] => {
  const minute = sample % CYCLE_MINUTES;
  const warming = Math.max(0, 4 - Math.abs(minute - 5));
  switch (kind) {
    case WarehouseSensorChannelKind.CO2:
      return { case: 'co2Ppm', value: 560 - warming * 20 };
    case WarehouseSensorChannelKind.DOOR:
      return { case: 'doorOpen', value: minute >= 1 && minute <= 4 };
    case WarehouseSensorChannelKind.HUMIDITY:
      return { case: 'relativeHumidityPercent', value: 72 + warming * 2 };
    case WarehouseSensorChannelKind.TEMPERATURE:
      return { case: 'deciCelsius', value: 40 + warming * 15 };
  }
};

const readChannelHistory = (kind: SimulatedChannelKindValue, installedAtMs: number, worldTimeMs: number): WarehouseSensorReading[] => {
  const lastSample = Math.floor((worldTimeMs - installedAtMs) / SAMPLE_INTERVAL_MS);
  const count = Math.min(MAX_READINGS_PER_CHANNEL, Math.max(0, lastSample + 1));
  const firstSample = lastSample - count + 1;
  return Array.from({ length: count }, (_, index) => {
    const sample = firstSample + index;
    return create(WarehouseSensorReadingSchema, {
      measuredAt: timestampFromMs(installedAtMs + sample * SAMPLE_INTERVAL_MS),
      value: readSampleValue(kind, sample),
    });
  });
};

export const readWarehouseSensors = (topology: WarehouseTopology, worldTimeMs: number): WarehouseSensorDevice[] =>
  SEED_WAREHOUSE_SENSORS.filter(sensor => sensor.warehouseId === topology.warehouseId && sensor.tenantId === topology.tenantId
    && topology.storageZones.some(zone => zone.id === sensor.zoneId)).map(sensor =>
    create(WarehouseSensorDeviceSchema, {
      channels: sensor.channels.map(channel => ({
        ...channel,
        readings: readChannelHistory(channel.kind, sensor.installedAtMs, worldTimeMs),
      })),
      code: sensor.code,
      id: sensor.id,
      zoneId: sensor.zoneId,
    }));
