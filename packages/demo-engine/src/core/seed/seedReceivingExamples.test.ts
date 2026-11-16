import {
  Code,
  createClient,
} from '@connectrpc/connect';
import { MarkingMode } from '@skladburg/contracts/catalog/v1/catalog';
import {
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { hasGs1CheckDigit } from '@skladburg/contracts/forms';
import {
  PaymentService,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  expect,
  it,
} from 'vitest';

import { createEngine } from '../engine/index';
import {
  createEngineTransport,
  createFakeRealTime,
} from '../engine/testing/engineHarness';
import {
  CARRIER_CALL,
  CUSTOMER_CALL,
} from '../modules/catalog/showcase/testing/showcaseFixtures';
import { createMemoryStorage } from '../ports/index';
import { SeedWarehouseId } from './seedIds';

it('opens both demo receipts in a fresh and reset warehouse world', async () => {
  const realTime = createFakeRealTime();
  const storage = createMemoryStorage();
  const engine = await createEngine({ epoch: 'rehearsal', isDemoWarehouseEnabled: true, realTime, storage });
  const transport = createEngineTransport(engine, true);
  const receiving = createClient(WarehouseReceivingService, transport);
  const deals = createClient(DealService, transport);
  const payments = createClient(PaymentService, transport);
  const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
  const { tasks } = await receiving.listReceivingTasks({ warehouseId }, CUSTOMER_CALL);

  expect(tasks).toHaveLength(2);
  expect(tasks.every(task => task.status === ReceivingTaskStatus.OPEN && task.updDocumentId !== '')).toBe(true);
  const marked = tasks.find(task => task.orderLines[0]?.markingMode === MarkingMode.UNIT);
  const plain = tasks.find(task => task.orderLines[0]?.markingMode === MarkingMode.NONE);
  expect(plain?.expectedUnits.map(unit => unit.sscc)).toEqual(['000000000000000017', undefined]);
  const codes = marked?.expectedUnits[0]?.batches[0]?.markingCodes;
  expect(codes).toHaveLength(3);
  expect(new Set(codes).size).toBe(3);
  expect(marked?.orderLines[0]?.quantityBase).toBe(3n);
  expect(hasGs1CheckDigit(marked?.orderLines[0]?.gtin ?? '')).toBe(true);
  for (const task of tasks) {
    expect((await deals.getDeal({ dealId: task.dealId }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.ARRIVED);
    expect((await payments.getDealPayment({ dealId: task.dealId }, CUSTOMER_CALL)).payment?.status).toBe(SafeDealPaymentStatus.HELD);
  }
  const mainWarehouse = await receiving.listReceivingTasks({ warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 }, CUSTOMER_CALL);
  expect(mainWarehouse.tasks).toEqual([]);
  await expect(receiving.listReceivingTasks({ warehouseId }, CARRIER_CALL)).rejects.toMatchObject({ code: Code.PermissionDenied });

  const reopened = await createEngine({ epoch: 'reopened', isDemoWarehouseEnabled: true, realTime, storage });
  const saved = createClient(WarehouseReceivingService, createEngineTransport(reopened, true));
  expect((await saved.listReceivingTasks({ warehouseId }, CUSTOMER_CALL)).tasks).toEqual(tasks);
  await engine.reset('reset');
  expect((await receiving.listReceivingTasks({ warehouseId }, CUSTOMER_CALL)).tasks).toEqual(tasks);
});

it('leaves an already saved world without demo receipts when it is reopened', async () => {
  const realTime = createFakeRealTime();
  const storage = createMemoryStorage();
  await createEngine({ epoch: 'saved', realTime, storage });
  const saved = await storage.load();
  const reopened = await createEngine({ epoch: 'reopened', isDemoWarehouseEnabled: true, realTime, storage });
  const receiving = createClient(WarehouseReceivingService, createEngineTransport(reopened, true));
  const { tasks } = await receiving.listReceivingTasks({ warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3 }, CUSTOMER_CALL);

  expect(tasks).toEqual([]);
  expect((await storage.load())?.collections.deals).toEqual(saved?.collections.deals);
});
