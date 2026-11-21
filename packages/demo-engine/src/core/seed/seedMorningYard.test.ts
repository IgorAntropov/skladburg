import type {
  ReceivingTask,
  YardWaitingReason,
} from '@skladburg/contracts/wms/v1/receiving';

import { createClient } from '@connectrpc/connect';
import { DocumentService } from '@skladburg/contracts/document/v1/document';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import {
  WarehouseReceivingService,
  YardDispatchAction,
  YardDispatchOutcome,
  YardPriorityFactor,
  YardWaitingReasonCode,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import {
  WarehouseEquipmentService,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import {
  expect,
  it,
} from 'vitest';

import { WAREHOUSE_YARD_MORNING } from '../../protocol/demoScenario';
import { createEngine } from '../engine/index';
import {
  createEngineTransport,
  createFakeRealTime,
} from '../engine/testing/engineHarness';
import { CUSTOMER_CALL } from '../modules/catalog/showcase/testing/showcaseFixtures';
import { nextUuid } from '../modules/catalog/testing/catalogFixtures';
import { createMemoryStorage } from '../ports/index';
import { SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID } from './seedWarehouseWorkspaceConfig';

const scope = { warehouseId: SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID };

it('replays the morning yard with 25 parked trucks, compatible assignments and an isolated reset', { timeout: 60_000 }, async () => {
  const realTime = createFakeRealTime();
  const engine = await createEngine({
    demoScenario: WAREHOUSE_YARD_MORNING,
    epoch: 'morning-yard',
    isDemoWarehouseEnabled: true,
    realTime,
    storage: createMemoryStorage(),
  });
  const transport = createEngineTransport(engine, true);
  const receiving = createClient(WarehouseReceivingService, transport);
  const equipment = createClient(WarehouseEquipmentService, transport);
  const readEquipment = (): ReturnType<typeof equipment.getWarehouseEquipment> => equipment.getWarehouseEquipment(scope, CUSTOMER_CALL);
  const fleet = await readEquipment();
  expect(fleet.equipment.map(unit => [unit.code, unit.batteryPercent, unit.status])).toEqual([
    ['ПГ-01', 18, WarehouseEquipmentStatus.AVAILABLE],
    ['ПГ-02', 85, WarehouseEquipmentStatus.AVAILABLE],
  ]);
  expect(fleet.stations).toHaveLength(1);
  expect(fleet.stations[0]?.equipmentId).toBeUndefined();
  const { topology } = await createClient(WarehouseTopologyService, transport).getWarehouseTopology(scope, CUSTOMER_CALL);
  const loadTasks = async (): Promise<ReceivingTask[]> => (await receiving.listReceivingTasks(scope, CUSTOMER_CALL)).tasks;
  const loadQueue = async (): Promise<YardWaitingReason[]> => (await receiving.listYardWaitingReasons(scope, CUSTOMER_CALL)).reasons;
  const { receivingArea } = topology ?? {};
  const docks = [receivingArea?.unloadingPoint, ...receivingArea?.additionalUnloadingPoints ?? []];
  const initialTasks = await loadTasks();
  expect(initialTasks).toHaveLength(25);
  expect(initialTasks.every(task => task.unloadingPointId === undefined)).toBe(true);
  expect(docks.map(dock => dock?.code)).toEqual(['D01', 'D02', 'D03', 'D04', 'D05', 'D06']);
  const wideDock = docks.find(dock => dock?.code === 'D04');
  const coldDock = docks.find(dock => dock?.code === 'D06');
  expect(wideDock?.capabilities).toContain(WarehouseCapability.OVERSIZE);
  expect(coldDock?.capabilities).toContain(WarehouseCapability.COLD);

  realTime.advance(5_000);
  await engine.tick();
  const charging = await readEquipment();
  expect(charging.equipment[0]).toMatchObject({ batteryPercent: 18, status: WarehouseEquipmentStatus.CHARGING });
  expect(charging.stations[0]?.equipmentId).toBe(fleet.equipment[0]?.id);
  expect(await loadTasks()).toEqual(initialTasks);
  const queue = await loadQueue();
  expect(queue).toHaveLength(25);
  expect(queue.filter(row => row.reason === YardWaitingReasonCode.WAITING_DOCUMENTS)).toHaveLength(23);
  const cold = queue.find(row => row.queuePosition === 1);
  const wide = queue.find(row => row.queuePosition === 2);
  if (cold === undefined || coldDock === undefined || wide === undefined || wideDock === undefined) {
    throw new Error('The morning yard needs both ready visits and their compatible docks');
  }
  expect(cold.dispatchOptions?.assignableUnloadingPointIds).toEqual([coldDock.id]);
  expect(wide.dispatchOptions?.assignableUnloadingPointIds).toEqual([wideDock.id]);
  expect(wide.priorityFactors).toContain(YardPriorityFactor.EXPLICIT_URGENCY);

  const trips = await createClient(LogisticsService, transport).listTrips({}, CUSTOMER_CALL);
  expect(trips.trips).toHaveLength(25);
  const { documents } = await createClient(DocumentService, transport).listDealDocuments({ dealId: wide.receivingTaskId }, CUSTOMER_CALL);
  expect(documents.map(document => document.content?.terms.case)).toEqual(expect.arrayContaining(['dispatchTitle', 'upd']));

  const priority = await receiving.promoteYardVisit({
    ...scope,
    expectedVersion: wide.taskVersion,
    idempotencyKey: nextUuid(),
    reason: 'Срочный длинномер',
    taskId: wide.receivingTaskId,
  }, CUSTOMER_CALL);
  expect(priority).toMatchObject({ outcome: YardDispatchOutcome.DOCK_ASSIGNED, unloadingPointId: wideDock.id });
  const assigned = (await loadTasks()).filter(task => task.unloadingPointId !== undefined);
  expect(assigned).toHaveLength(2);
  expect(assigned.find(task => task.id === cold.receivingTaskId)?.unloadingPointId).toBe(coldDock.id);
  const journal = await receiving.listYardDispatchEntries(scope, CUSTOMER_CALL);
  expect(journal.entries).toEqual([expect.objectContaining({ action: YardDispatchAction.PROMOTE, taskId: wide.receivingTaskId })]);

  await engine.reset('morning-yard-reset');
  expect(await readEquipment()).toEqual(fleet);
  expect(await loadTasks()).toEqual(initialTasks);
  expect((await receiving.listYardDispatchEntries(scope, CUSTOMER_CALL)).entries).toEqual([]);
});
