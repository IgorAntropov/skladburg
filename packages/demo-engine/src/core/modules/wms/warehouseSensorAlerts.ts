import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  type WarehouseSensorAlert,
  WarehouseSensorAlertSchema,
} from '@skladburg/contracts/common/v1/warehouse_sensor_alert';
import { WarehouseSensorChannelKind } from '@skladburg/contracts/wms/v1/warehouse_sensors';

import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';
import type { WarehouseSensorAlertRecordValue } from '../../state/warehouseSensorAlertRecord';
import type { IModuleRuntime } from '../moduleRuntime';

import { SEED_WAREHOUSE_SENSORS } from '../../seed/seedWarehouseSensors';
import { WAREHOUSE_SENSOR_INTERVAL_MS } from '../../seed/warehouseSensorConfig';
import { publishWarehouseSensorAlert } from '../notifications/warehouseSensorAlerts';
import {
  CYCLE_MINUTES,
  getWarehouseSensorSample,
  MAX_READINGS_PER_CHANNEL,
  readSensorDeciCelsius,
} from './warehouseSensorSimulation';
import { readOwnedWarehouseTopology } from './warehouseTopologyRecords';

type SensorValue = typeof SEED_WAREHOUSE_SENSORS[number];

export const readConfirmedSensorAlert = (
  errors: IDomainErrors,
  record: undefined | WarehouseSensorAlertRecordValue,
  tenantId: string,
  warehouseId: string,
  zoneId: string,
): undefined | WarehouseSensorAlert => {
  if (record === undefined) {
    return undefined;
  }
  if (record.tenantId !== tenantId || record.warehouseId !== warehouseId) {
    throw errors.internal();
  }
  if (record.alertBytes === undefined) {
    return undefined;
  }
  const alert = fromBinary(WarehouseSensorAlertSchema, record.alertBytes);
  if (alert.channelId !== record.id || alert.warehouseId !== warehouseId || alert.zoneId !== zoneId) {
    throw errors.internal();
  }
  return alert;
};

const reconcileChannel = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  sensor: SensorValue,
  channelId: string,
  zoneCode: string,
  firstCheckMs: number,
): void => {
  const { installedAtMs, tenantId, thresholdDeciCelsius, warehouseId, zoneId } = sensor;
  const current = getWarehouseSensorSample(transaction.worldTimeMs, installedAtMs);
  const record = transaction.get('warehouseSensorAlerts', channelId);
  if (current < 0 || (record !== undefined && record.lastSample >= current)) {
    return;
  }
  let alert = readConfirmedSensorAlert(runtime.errors, record, tenantId, warehouseId, zoneId);
  const measuredAt = (sample: number): ReturnType<typeof timestampFromMs> =>
    timestampFromMs(installedAtMs + sample * WAREHOUSE_SENSOR_INTERVAL_MS);
  const applySample = (sample: number): void => {
    const temperature = readSensorDeciCelsius(sample);
    if (temperature > thresholdDeciCelsius) {
      if (alert !== undefined && alert.resolvedAt === undefined) {
        return;
      }
      let opening = sample;
      while (opening > 0 && sample - opening < CYCLE_MINUTES && readSensorDeciCelsius(opening - 1) > thresholdDeciCelsius) {
        opening -= 1;
      }
      alert = create(WarehouseSensorAlertSchema, {
        channelId, id: runtime.random.uuid(), openedAt: measuredAt(opening), openedDeciCelsius: readSensorDeciCelsius(opening),
        thresholdDeciCelsius, warehouseId, zoneCode, zoneId,
      });
    }
    else {
      if (alert === undefined || alert.resolvedAt !== undefined) {
        return;
      }
      alert = { ...alert, resolvedAt: measuredAt(sample), resolvedDeciCelsius: temperature };
    }
    publishWarehouseSensorAlert(runtime, transaction, alert);
  };
  const start = record === undefined ? Math.max(0, getWarehouseSensorSample(firstCheckMs, installedAtMs)) : record.lastSample + 1;
  const first = Math.max(start, current - MAX_READINGS_PER_CHANNEL + 1);
  if (record !== undefined && first > record.lastSample + 1 && alert !== undefined && alert.resolvedAt === undefined) {
    const limit = Math.min(first - 1, record.lastSample + CYCLE_MINUTES);
    for (let sample = record.lastSample + 1; sample <= limit; sample += 1) {
      if (readSensorDeciCelsius(sample) <= thresholdDeciCelsius) {
        applySample(sample);
        break;
      }
    }
  }
  for (let sample = first; sample <= current; sample += 1) {
    applySample(sample);
  }
  transaction.put('warehouseSensorAlerts', {
    alertBytes: alert === undefined ? undefined : toBinary(WarehouseSensorAlertSchema, alert),
    id: channelId, lastSample: current, tenantId, warehouseId,
  });
};

export const refreshWarehouseSensorAlerts = (runtime: IModuleRuntime, firstCheckMs: number): Promise<void> =>
  runtime.command((transaction) => {
    for (const sensor of SEED_WAREHOUSE_SENSORS) {
      const { tenantId, warehouseId } = sensor;
      if (transaction.get('warehouses', warehouseId)?.tenantId !== tenantId) {
        continue;
      }
      const topology = readOwnedWarehouseTopology(transaction, runtime.errors, warehouseId, tenantId);
      const zone = topology?.storageZones.find(candidate => candidate.id === sensor.zoneId);
      const channel = sensor.channels.find(candidate => candidate.kind === WarehouseSensorChannelKind.TEMPERATURE);
      if (zone !== undefined && channel !== undefined) {
        reconcileChannel(runtime, transaction, sensor, channel.id, zone.code, firstCheckMs);
      }
    }
  });
