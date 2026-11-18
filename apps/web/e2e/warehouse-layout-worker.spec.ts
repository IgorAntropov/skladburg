import type { Client } from '@connectrpc/connect';
import type { Page } from '@playwright/test';

import {
  ConnectError,
  createClient,
} from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { WarehouseLayoutSessionService } from '@skladburg/contracts/wms/v1/layout_session';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import { randomUUID } from 'node:crypto';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';

import {
  expect,
  test,
} from './fixtures/test.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';

const WAREHOUSE_ID = '80000001-0000-4000-8000-000000000000';
const ZONE_ID = '8f000002-0000-4000-8000-000000000001';
const ZONE = { warehouseId: WAREHOUSE_ID, zoneId: ZONE_ID };

type LayoutClientValue = Client<typeof WarehouseLayoutSessionService> & Client<typeof WarehouseTopologyService>;

interface LayoutWorkerValue {
  epoch: string;
  layout: LayoutClientValue;
  worker: EngineWorkerRobotValue;
}

const createLayoutWorker = async (page: Page): Promise<LayoutWorkerValue> => {
  const worker = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
  const startup = await worker.readStartup();
  if (startup?.kind !== 'ready') {
    throw new Error('Expected the layout Worker to be ready');
  }

  const transport = createConnectTransport({
    baseUrl: 'https://demo-engine.invalid',
    fetch: async (input, init): Promise<Response> => {
      const request = new Request(input, init);
      const response = await worker.request(new URL(request.url).pathname.slice(1), new Uint8Array(await request.arrayBuffer()));

      return new Response(Uint8Array.from(response.body).buffer, { headers: response.headers, status: response.status });
    },
    useBinaryFormat: true,
  });

  const layout = { ...createClient(WarehouseTopologyService, transport), ...createClient(WarehouseLayoutSessionService, transport) };

  return { epoch: startup.epoch, layout, worker };
};

const expectLayoutFailure = async (pending: Promise<unknown>, code: ErrorCode): Promise<void> => {
  const failure = await pending.then(() => undefined, (error: unknown) => ConnectError.from(error));
  expect(failure?.findDetails(ErrorDetailSchema).map(detail => detail.code)).toEqual([code]);
};

test('only one tab of the same persona can open and edit a warehouse zone', async ({ context, page }) => {
  const first = await createLayoutWorker(page);
  const second = await createLayoutWorker(await context.newPage());
  expect(second.epoch).toBe(first.epoch);

  const open = { ...ZONE, idempotencyKey: randomUUID() };
  const [firstAttempt, secondAttempt] = await Promise.allSettled([
    first.layout.openWarehouseLayoutSession(open),
    second.layout.openWarehouseLayoutSession(open),
  ]);
  const isFirstOwner = firstAttempt.status === 'fulfilled';
  const [accepted, rejected] = isFirstOwner ? [firstAttempt, secondAttempt] : [secondAttempt, firstAttempt];
  const [owner, otherTab] = isFirstOwner ? [first.layout, second.layout] : [second.layout, first.layout];

  if (accepted.status !== 'fulfilled' || rejected.status !== 'rejected') {
    throw new Error(`Expected one open session and one rejection, got ${firstAttempt.status} and ${secondAttempt.status}`);
  }
  expect(ConnectError.from(rejected.reason).findDetails(ErrorDetailSchema)).toMatchObject([{
    code: ErrorCode.WAREHOUSE_LAYOUT_BUSY,
    params: { case: 'warehouseLayoutBusy', value: { expiresAt: accepted.value.expiresAt, zoneId: ZONE_ID } },
  }]);

  const session = { ...ZONE, layoutSessionId: accepted.value.layoutSessionId };
  const renew = { ...session, idempotencyKey: randomUUID() };
  expect((await owner.renewWarehouseLayoutSession(renew)).expiresAt).toBeDefined();
  await expectLayoutFailure(otherTab.renewWarehouseLayoutSession(renew), ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);

  const { topology } = await owner.getWarehouseTopology({ warehouseId: WAREHOUSE_ID });
  const expectedRevision = topology?.revision;
  if (expectedRevision === undefined) {
    throw new Error('Expected the seeded warehouse topology');
  }
  const edit = {
    cells: [{
      cellCode: 'Z01-R01-S02-Y01-C01',
      rackCode: 'S02',
      rackFootprint: { depthMm: 1_000, origin: { xMm: 6_000, zMm: 1_000 }, widthMm: 600 },
      rowCode: 'R01',
      tierCode: 'Y01',
      tierElevationMm: 0,
      widthMm: 600,
      zoneCode: 'Z01',
    }],
    expectedRevision,
    idempotencyKey: randomUUID(),
    layoutSessionId: session.layoutSessionId,
    warehouseId: WAREHOUSE_ID,
  };
  await expectLayoutFailure(otherTab.addWarehouseCells(edit), ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
  expect(await owner.addWarehouseCells(edit)).toMatchObject({ revision: expectedRevision + 1 });

  const release = { ...session, idempotencyKey: randomUUID() };
  await otherTab.releaseWarehouseLayoutSession(release);
  const nextOpen = { ...ZONE, idempotencyKey: randomUUID() };
  await expectLayoutFailure(otherTab.openWarehouseLayoutSession(nextOpen), ErrorCode.WAREHOUSE_LAYOUT_BUSY);
  await owner.releaseWarehouseLayoutSession(release);
  const reassigned = await otherTab.openWarehouseLayoutSession(nextOpen);
  expect(reassigned.layoutSessionId).not.toBe(session.layoutSessionId);
});

test('retains the editing tab’s warehouse zone session when the leader tab closes', async ({ context, page }) => {
  const first = await createLayoutWorker(page);
  const second = await createLayoutWorker(await context.newPage());
  expect(second.epoch).toBe(first.epoch);
  const { layoutSessionId } = await second.layout.openWarehouseLayoutSession({ ...ZONE, idempotencyKey: randomUUID() });
  const session = { ...ZONE, layoutSessionId };
  const renew = { ...session, idempotencyKey: randomUUID() };
  const priorRenewal = await second.layout.renewWarehouseLayoutSession(renew);
  expect(priorRenewal.expiresAt).toBeDefined();

  await page.close();
  await expect.poll(second.worker.readStartup).toMatchObject({
    epoch: expect.not.stringContaining(first.epoch),
    kind: 'ready',
    storage: 'indexed-db',
  });

  expect(await second.layout.renewWarehouseLayoutSession(renew)).toEqual(priorRenewal);
  expect((await second.layout.renewWarehouseLayoutSession({ ...session, idempotencyKey: randomUUID() })).expiresAt).toBeDefined();
});
