import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  type GetWarehouseSensorsResponse,
  WarehouseSensorChannelKind,
  WarehouseSensorService,
} from '@skladburg/contracts/wms/v1/warehouse_sensors';
import { WAREHOUSE_YARD_MORNING } from '@skladburg/demo-engine/client';

import { OWN_NETWORK_SITES } from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { changeStoredEngineMetadata } from './robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';

const KAZAN = { warehouseId: OWN_NETWORK_SITES[2].id };
const MINUTE_MS = 60_000;

test('restores the last hour of warehouse sensor readings including the cold room excursion', async ({ page }) => {
  const readSensors = async (): Promise<GetWarehouseSensorsResponse> => {
    const worker = await createEngineWorkerRobot(page, DEAL_CUSTOMER, './', WAREHOUSE_YARD_MORNING);
    try {
      await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
      return await callYardWorker(worker, WarehouseSensorService.method.getWarehouseSensors, KAZAN);
    }
    finally {
      await worker.stop();
    }
  };

  const initial = await readSensors();
  expect(initial.devices).toHaveLength(1);
  const initialDevice = initial.devices[0];
  const initialReading = initialDevice?.channels.find(channel => channel.kind === WarehouseSensorChannelKind.TEMPERATURE)?.readings[0];
  if (initialReading?.measuredAt === undefined) {
    throw new Error('Missing first cold room temperature reading');
  }
  expect(initialReading.value).toEqual({ case: 'deciCelsius', value: 40 });
  const startMs = timestampMs(initialReading.measuredAt);
  const lastMinute = 70;
  await changeStoredEngineMetadata(page, {
    demoScenario: WAREHOUSE_YARD_MORNING,
    isClockPaused: true,
    seedVersionOffset: 0,
    worldTimeMs: startMs + lastMinute * MINUTE_MS + 500,
  });

  const history = await readSensors();
  expect(history.devices).toHaveLength(1);
  const device = history.devices[0];
  expect(device).toMatchObject({ id: initialDevice?.id, zoneId: '8f000004-0000-4000-8000-000000000001' });
  const channels = device?.channels ?? [];
  expect(channels.map(channel => channel.kind).sort()).toEqual([
    WarehouseSensorChannelKind.TEMPERATURE,
    WarehouseSensorChannelKind.HUMIDITY,
    WarehouseSensorChannelKind.DOOR,
    WarehouseSensorChannelKind.CO2,
  ].sort());
  const expectedTimes = Array.from({ length: 60 }, (_, index) => startMs + (lastMinute - 59 + index) * MINUTE_MS);
  for (const channel of channels) {
    expect(channel.readings.map(({ measuredAt }) => measuredAt === undefined ? undefined : timestampMs(measuredAt))).toEqual(expectedTimes);
  }
  const temperatures = channels.find(channel => channel.kind === WarehouseSensorChannelKind.TEMPERATURE)
    ?.readings.map(reading => reading.value.case === 'deciCelsius' ? reading.value.value : undefined) ?? [];
  const normal = temperatures.indexOf(40);
  const peak = temperatures.indexOf(100, normal + 1);
  expect(normal).toBeGreaterThanOrEqual(0);
  expect(peak).toBeGreaterThan(normal);
  expect(temperatures.indexOf(40, peak + 1)).toBeGreaterThan(peak);
  expect(await readSensors()).toEqual(history);
});
