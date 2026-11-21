import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type { WarehouseSensorChannel } from '@skladburg/contracts/wms/v1/warehouse_sensors';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import { sensorsChannel } from '@skladburg/contracts/runtime';
import {
  WarehouseSensorChannelKind,
  WarehouseSensorService,
} from '@skladburg/contracts/wms/v1/warehouse_sensors';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';

import { OWN_NETWORK_SITES } from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { PHONE_VIEWPORT } from './fixtures/viewports.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { changeStoredEngineMetadata } from './robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createNotificationRobot } from './robots/notification-robot.ts';

const KAZAN = { warehouseId: OWN_NETWORK_SITES[2].id };
const MINUTE_MS = 60_000;

const readTemperature = async (worker: EngineWorkerRobotValue): Promise<undefined | WarehouseSensorChannel> => {
  const { devices } = await callYardWorker(worker, WarehouseSensorService.method.getWarehouseSensors, KAZAN);
  return devices[0]?.channels.find(channel => channel.kind === WarehouseSensorChannelKind.TEMPERATURE);
};

const readAlertNotices = async (worker: EngineWorkerRobotValue): Promise<Notification[]> => {
  const { notifications } = await callYardWorker(worker, NotificationService.method.listNotifications, { page: { pageSize: 30 } });
  return notifications.filter(notification => notification.params.case === 'warehouseSensorAlert');
};

test('updates one cold room alert in two open notification centers and preserves its read state', async ({ context, page }) => {
  test.setTimeout(95_000);
  const control = await context.newPage();
  const seed = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  let startMs: number;
  try {
    await expect.poll(seed.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    const first = (await readTemperature(seed))?.readings[0]?.measuredAt;
    if (first === undefined) {
      throw new Error('Missing initial temperature in the Kazan warehouse');
    }
    startMs = timestampMs(first);
  }
  finally {
    await seed.stop();
  }
  await changeStoredEngineMetadata(control, { isClockPaused: false, seedVersionOffset: 0, timeScale: 10, worldTimeMs: startMs });
  const observer = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  try {
    await expect.poll(observer.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    const subscription = await observer.subscribe(sensorsChannel(KAZAN.warehouseId));
    if (subscription.kind !== 'subscribed') {
      throw new Error('Missing subscription to the Kazan sensor channel');
    }
    const other = await context.newPage();
    const pages = [page, other];
    await Promise.all(pages.map(tab => tab.addInitScript({ content: createStoreSystemThemeScript() })));
    await other.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
    await other.setViewportSize(PHONE_VIEWPORT);
    await page.emulateMedia({ colorScheme: 'light' });
    await other.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await Promise.all(pages.map(tab => tab.goto('./#/network')));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
    const centers = pages.map(createNotificationRobot);
    await Promise.all(centers.map(center => center.open()));
    await expect.poll(() => readAlertNotices(observer), { timeout: 35_000 }).toHaveLength(1);
    const [notice] = await readAlertNotices(observer);
    const alert = (await readTemperature(observer))?.alert;
    if (notice?.params.case !== 'warehouseSensorAlert' || alert?.openedAt === undefined) {
      throw new Error('Missing confirmed cold room alert');
    }
    expect(notice.params.value).toEqual(alert);
    expect(timestampMs(alert.openedAt)).toBe(startMs + 4 * MINUTE_MS);
    expect(alert.resolvedAt).toBeUndefined();
    for (const center of centers) {
      await expect(center.getRowById(notice.id)).toContainText('8,5');
    }
    await createNotificationRobot(page).markAllRead();
    await expect.poll(async () => (await readTemperature(observer))?.alert?.resolvedAt, { timeout: 30_000 }).toBeDefined();
    for (const center of centers) {
      const row = center.getRowById(notice.id);
      await expect(row).toContainText('Температура в норме');
      await center.expectRead(row);
    }
    const notices = await readAlertNotices(observer);
    expect(notices).toHaveLength(1);
    const closed = (await readTemperature(observer))?.alert;
    expect(closed).toMatchObject({ id: alert.id, openedAt: alert.openedAt, resolvedDeciCelsius: 70 });
    expect(closed?.resolvedAt === undefined ? undefined : timestampMs(closed.resolvedAt)).toBe(startMs + 7 * MINUTE_MS);
    expect(notices[0]).toMatchObject({ id: notice.id, params: { case: 'warehouseSensorAlert', value: closed } });
    expect((await observer.readEvents(subscription.id)).map(event => event.payload.case)).toEqual([
      'warehouseSensorAlertsChanged', 'warehouseSensorAlertsChanged',
    ]);
  }
  finally {
    await observer.stop();
  }
});
