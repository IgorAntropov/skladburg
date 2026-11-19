import type { Page } from '@playwright/test';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';

import type { YardVehicleMarkingsFixtureValue } from './sixDockWarehouse.ts';

import { DEAL_CUSTOMER } from '../robots/deal-worker-robot.ts';
import { changeStoredEngineMetadata } from '../robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from '../robots/engine-worker-robot.ts';
import { createPersonaRobot } from '../robots/persona-robot.ts';
import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './demoData.ts';
import {
  toObjectHash,
  toWarehouseRoute,
} from './routes.ts';
import { storeYardVehicleMarkings } from './sixDockWarehouse.ts';
import { expect } from './test.ts';
import { callYardWorker } from './yardPolicyQueue.ts';

export const YARD_MARKINGS_SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };

const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(YARD_MARKINGS_SCOPE.warehouseId));
const DAY_MS = Date.UTC(2026, 9, 12, 10);
const NIGHT_MS = Date.UTC(2026, 9, 12, 17);

export const prepareYardVehicleMarkings = async (
  page: Page,
  visitCount: 1 | 25 | 30,
  time: 'day' | 'night',
  isDirectDelivery = false,
): Promise<YardVehicleMarkingsFixtureValue> => {
  const seed = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  const { deliveries, topology, warehouse } = await (async () => {
    const [{ tasks }, { topology }, { warehouses }] = await Promise.all([
      callYardWorker(seed, WarehouseReceivingService.method.listReceivingTasks, YARD_MARKINGS_SCOPE),
      callYardWorker(seed, WarehouseTopologyService.method.getWarehouseTopology, YARD_MARKINGS_SCOPE),
      callYardWorker(seed, OrganizationService.method.listWarehouses, {}),
    ]);
    const warehouse = warehouses.find(({ id }) => id === YARD_MARKINGS_SCOPE.warehouseId);
    if (topology === undefined || warehouse === undefined) {
      throw new Error('The vehicle markings fixture needs the seeded Kazan warehouse');
    }
    expect(warehouse.timeZone).toBe('Europe/Moscow');
    const deliveries = await Promise.all(tasks.map(async (task) => {
      const { deal } = await callYardWorker(seed, DealService.method.getDeal, { dealId: task.dealId });
      if (deal === undefined) {
        throw new Error(`Missing the source deal for ${task.id}`);
      }
      return { deal, task };
    }));
    return { deliveries, topology, warehouse };
  })().finally(seed.stop);
  const fixture = await storeYardVehicleMarkings(page, topology, warehouse, deliveries, visitCount, isDirectDelivery);
  await changeStoredEngineMetadata(page, { isClockPaused: true, seedVersionOffset: 0, worldTimeMs: time === 'day' ? DAY_MS : NIGHT_MS });
  return fixture;
};

export const openYardVehicleMarkings = async (page: Page, personaId: string = PERSONAS.freshCustomer.id): Promise<void> => {
  await createPersonaRobot(page).openAsPersona(WAREHOUSE_HASH, personaId);
  await page.getByRole('tab').and(page.locator('[id$="-trigger-yard"]')).press('Enter');
  await expect(page.getByTestId('warehouse-yard-dispatch')).toBeVisible();
};
