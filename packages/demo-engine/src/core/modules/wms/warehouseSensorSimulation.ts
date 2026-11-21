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
import { WAREHOUSE_SENSOR_INTERVAL_MS } from '../../seed/warehouseSensorConfig';

export const MAX_READINGS_PER_CHANNEL = 60;
export const CYCLE_MINUTES = 12;

type SimulatedChannelKindValue = typeof SEED_WAREHOUSE_SENSORS[number]['channels'][number]['kind'];

export const getWarehouseSensorSample = (worldTimeMs: number, installedAtMs: number): number =>
  Math.floor((worldTimeMs - installedAtMs) / WAREHOUSE_SENSOR_INTERVAL_MS);

const readWarming = (sample: number): number => Math.max(0, 4 - Math.abs(sample % CYCLE_MINUTES - 5));

export const readSensorDeciCelsius = (sample: number): number => 40 + readWarming(sample) * 15;

const readSampleValue = (kind: SimulatedChannelKindValue, sample: number): WarehouseSensorReading['value'] => {
  const minute = sample % CYCLE_MINUTES;
  switch (kind) {
    case WarehouseSensorChannelKind.CO2:
      return { case: 'co2Ppm', value: 560 - readWarming(sample) * 20 };
    case WarehouseSensorChannelKind.DOOR:
      return { case: 'doorOpen', value: minute >= 1 && minute <= 4 };
    case WarehouseSensorChannelKind.HUMIDITY:
      return { case: 'relativeHumidityPercent', value: 72 + readWarming(sample) * 2 };
    case WarehouseSensorChannelKind.TEMPERATURE:
      return { case: 'deciCelsius', value: readSensorDeciCelsius(sample) };
  }
};

const readChannelHistory = (kind: SimulatedChannelKindValue, installedAtMs: number, worldTimeMs: number): WarehouseSensorReading[] => {
  const lastSample = getWarehouseSensorSample(worldTimeMs, installedAtMs);
  const count = Math.min(MAX_READINGS_PER_CHANNEL, Math.max(0, lastSample + 1));
  const firstSample = lastSample - count + 1;
  return Array.from({ length: count }, (_, index) => {
    const sample = firstSample + index;
    return create(WarehouseSensorReadingSchema, {
      measuredAt: timestampFromMs(installedAtMs + sample * WAREHOUSE_SENSOR_INTERVAL_MS),
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
