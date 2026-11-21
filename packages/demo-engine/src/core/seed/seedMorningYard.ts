import type { MessageInitShape } from '@bufbuild/protobuf';
import type { TransportCargoSchema } from '@skladburg/contracts/logistics/v1/logistics_records';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  CarrierLaneSchema,
  DriverSchema,
  VehicleBodyType,
  VehicleCargoKind,
  VehicleSchema,
} from '@skladburg/contracts/fleet/v1/fleet';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import {
  ReceivingTaskSchema,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { HandlingUnitKind } from '@skladburg/contracts/wms/v1/stock';
import { WarehouseUnloadingPointSchema } from '@skladburg/contracts/wms/v1/topology';

import type { IModuleRuntime } from '../modules/moduleRuntime';
import type { EngineSnapshotValue } from '../ports/index';
import type { SchedulerTaskValue } from '../scheduler/index';
import type { HistoryRouteValue } from './seedDealHistory';

import { WAREHOUSE_YARD_MORNING } from '../../protocol/demoScenario';
import { findInterWarehouseRoutes } from '../modules/network/index';
import { loadPayments } from '../modules/payments/loadPayments';
import { readInboundYardGate } from '../modules/wms/inboundYardGate';
import { createWarehouseTopologyRecord } from '../modules/wms/warehouseTopologyRecords';
import {
  createEngineState,
  TABLE_DEFINITIONS,
} from '../state/index';
import { SEED_WORLD_START_MS } from './seedConfig';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';
import {
  MORNING_YARD_FREIGHT_MINOR,
  prepareMorningYardTransport,
} from './seedMorningYardTransport';
import { createSeedWarehouseEquipment } from './seedWarehouseEquipment';
import { createSeedWarehouseTopology } from './seedWarehouseTopologies';
import { SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID } from './seedWarehouseWorkspaceConfig';

interface MorningYardExamplesValue {
  routes: readonly HistoryRouteValue[];
  snapshot: EngineSnapshotValue;
}

interface MorningYardRouteValue {
  bodyType: VehicleBodyType;
  cargo: MessageInitShape<typeof TransportCargoSchema>;
  carrierOrganizationId: string;
  carrierUserId: string;
  count: number;
  firstVisitNumber: number;
  listingId: string;
  quantity: bigint;
  supplier: HistoryRouteValue['supplier'];
  unitCount: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const FIRST_ARRIVAL_MS = SEED_WORLD_START_MS - HOUR_MS;
const PLACED_ORDER_MS = Date.UTC(2026, 9, 5, 8);
const YARD_WAREHOUSE_ID = SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID;
const CUSTOMER = { organizationId: SeedOrganizationId.CUSTOMER_1, userId: SeedUserId.ADMIN_1, warehouseId: YARD_WAREHOUSE_ID };
const YARD_ROUTES: readonly MorningYardRouteValue[] = [
  {
    bodyType: VehicleBodyType.REFRIGERATED,
    cargo: {
      bodyTypes: [VehicleBodyType.REFRIGERATED],
      cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED,
      heightMillimeters: 1_200,
      lengthMillimeters: 1_200,
      palletPlaces: 1,
      temperature: { maxCelsius: 6, minCelsius: 2 },
      volumeCubicCentimeters: 1_152_000n,
      weightGrams: 125_000n,
      widthMillimeters: 800,
    },
    carrierOrganizationId: SeedOrganizationId.CARRIER_1,
    carrierUserId: SeedUserId.ADMIN_4,
    count: 24,
    firstVisitNumber: 1,
    listingId: 'd1020020-0000-4000-8000-000000000000',
    quantity: 100_000n,
    supplier: {
      organizationId: SeedOrganizationId.SUPPLIER_2,
      userId: SeedUserId.ADMIN_3,
      warehouseId: SeedWarehouseId.SUPPLIER_2_WAREHOUSE_1,
    },
    unitCount: 1,
  },
  {
    bodyType: VehicleBodyType.LOW_LOADER,
    cargo: {
      bodyTypes: [VehicleBodyType.LOW_LOADER],
      cargoKind: VehicleCargoKind.OVERSIZE,
      heightMillimeters: 300,
      lengthMillimeters: 11_700,
      palletPlaces: 0,
      volumeCubicCentimeters: 3_510_000n,
      weightGrams: 2_010_000n,
      widthMillimeters: 1_000,
    },
    carrierOrganizationId: SeedOrganizationId.CARRIER_2,
    carrierUserId: SeedUserId.ADMIN_8,
    count: 1,
    firstVisitNumber: 25,
    listingId: 'd1030001-0000-4000-8000-000000000000',
    quantity: 2_000_000n,
    supplier: {
      organizationId: SeedOrganizationId.SUPPLIER_3,
      userId: SeedUserId.ADMIN_6,
      warehouseId: SeedWarehouseId.SUPPLIER_3_WAREHOUSE_1,
    },
    unitCount: 2,
  },
];

const seedId = (number: number): string => `d5000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

const createYardTopologyRecord = (): ReturnType<typeof createWarehouseTopologyRecord> => {
  const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: CUSTOMER.organizationId, warehouseId: YARD_WAREHOUSE_ID });
  const area = topology.receivingArea;
  if (area?.unloadingPoint === undefined) {
    throw new Error('A receiving area is required for the morning yard');
  }
  const specialties = [undefined, undefined, undefined, WarehouseCapability.OVERSIZE, undefined, WarehouseCapability.COLD];
  area.unloadingPoint.capabilities = [WarehouseCapability.RAMP];
  area.additionalUnloadingPoints = specialties.slice(1).map((capability, index) => create(WarehouseUnloadingPointSchema, {
    capabilities: capability === undefined ? [WarehouseCapability.RAMP] : [WarehouseCapability.RAMP, capability],
    code: `D0${String(index + 2)}`,
    id: seedId(index + 2),
    position: { xMm: 1_000 + (index + 1) * 6_400 },
  }));
  area.footprint = { $typeName: 'wms.v1.WarehouseFloorRect', depthMm: 3_000,
    origin: { $typeName: 'wms.v1.WarehouseFloorPoint', xMm: 1_000, zMm: 2_100 }, widthMm: 34_000 };
  return createWarehouseTopologyRecord(topology);
};

export const createMorningYardExamples = (snapshot: EngineSnapshotValue): MorningYardExamplesValue => {
  const { read } = createEngineState(snapshot);
  const warehouse = read.get('warehouses', YARD_WAREHOUSE_ID);
  if (warehouse === undefined) {
    throw new Error('The Kazan warehouse is required for the morning yard');
  }
  const warehouseTopologies = new Map(snapshot.collections.warehouseTopologies);
  const topology = createYardTopologyRecord();
  warehouseTopologies.set(topology.id, TABLE_DEFINITIONS.warehouseTopologies.encode(topology));

  const warehouses = new Map(snapshot.collections.warehouses);
  warehouses.set(warehouse.id, TABLE_DEFINITIONS.warehouses.encode({
    ...warehouse, capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD, WarehouseCapability.OVERSIZE],
  }));
  const carrierLanes = new Map(snapshot.collections.carrierLanes);
  const drivers = new Map(snapshot.collections.drivers);
  const vehicles = new Map(snapshot.collections.vehicles);
  const paths = findInterWarehouseRoutes(read, warehouse);
  const routes = YARD_ROUTES.map((route, routeIndex): HistoryRouteValue => {
    const pickup = read.get('warehouses', route.supplier.warehouseId);
    const path = pickup === undefined ? undefined : paths.get(pickup.mapNodeId);
    if (pickup === undefined || path === undefined) {
      throw new Error('A route to Kazan is required for the morning yard');
    }
    const lane = create(CarrierLaneSchema, {
      departureWeekdays: [1, 2, 3, 4, 5, 6, 7], fromCityId: pickup.cityId, id: seedId(10 + routeIndex), isActive: true,
      tariff: { amountMinor: MORNING_YARD_FREIGHT_MINOR, currencyCode: 'RUB' }, tenantId: route.carrierOrganizationId,
      toCityId: warehouse.cityId, version: 1n,
    });
    carrierLanes.set(lane.id, TABLE_DEFINITIONS.carrierLanes.encode(lane));
    const orders = Array.from({ length: route.count }, (_unused, index) => {
      const visitNumber = route.firstVisitNumber + index;
      const label = String(visitNumber).padStart(3, '0');
      const arrivalMs = FIRST_ARRIVAL_MS + (visitNumber - 1) * 2 * MINUTE_MS;
      const departureMs = arrivalMs - path.driveMinutes * MINUTE_MS;
      const driver = create(DriverSchema, {
        displayName: `Водитель ${label}`, id: seedId(100 + visitNumber), isActive: true, tenantId: route.carrierOrganizationId, version: 1n,
      });
      const vehicle = create(VehicleSchema, {
        details: {
          availability: [{ cityId: pickup.cityId, endsAt: timestampFromMs(arrivalMs + HOUR_MS), startsAt: timestampFromMs(departureMs) }],
          bodyType: route.bodyType,
          cargoKinds: [route.cargo.cargoKind ?? VehicleCargoKind.GENERAL],
          heightMillimeters: 2_600,
          lengthMillimeters: 13_600,
          palletPlaces: 33,
          payloadGrams: 20_000_000n,
          registrationNumber: `М${label}МК 000`,
          temperature: route.cargo.temperature,
          volumeCubicCentimeters: 85_000_000n,
          widthMillimeters: 2_450,
        },
        id: seedId(200 + visitNumber),
        tenantId: route.carrierOrganizationId,
        version: 1n,
      });
      drivers.set(driver.id, TABLE_DEFINITIONS.drivers.encode(driver));
      vehicles.set(vehicle.id, TABLE_DEFINITIONS.vehicles.encode(vehicle));
      const hasCarrierTitle = index === 0;

      return {
        isUrgent: hasCarrierTitle,
        listingId: route.listingId,
        manifest: { sourceDocumentNumber: `ДВОР-${label}`, units: Array.from({ length: route.unitCount }, () => ({
          batches: [{ batchNumber: `ДВОР-${label}`, listingId: route.listingId, quantityBase: route.quantity / BigInt(route.unitCount) }],
          kind: HandlingUnitKind.PALLET, sscc: undefined,
        })) },
        prepareTransport: (context: Parameters<typeof prepareMorningYardTransport>[0]): ReturnType<typeof prepareMorningYardTransport> =>
          prepareMorningYardTransport(context, {
            arrivalMs, cargo: route.cargo, carrierOrganizationId: route.carrierOrganizationId, carrierUserId: route.carrierUserId,
            departureMs, driverId: driver.id, hasCarrierTitle, vehicleId: vehicle.id,
          }),
        quantity: route.quantity,
        submittedAtMs: PLACED_ORDER_MS,
      };
    });
    return { cityId: pickup.cityId, customer: CUSTOMER, orders, supplier: route.supplier };
  });

  return { routes, snapshot: { ...snapshot, collections: { ...snapshot.collections, carrierLanes, drivers, vehicles, warehouses,
    warehouseTopologies } } };
};

export const parkMorningYardVisits = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const { read } = createEngineState(snapshot);
  const warehouseInbound = new Map(snapshot.collections.warehouseInbound);
  for (const record of read.listBy('warehouseInbound', 'scopeId', YARD_WAREHOUSE_ID)) {
    const task = fromBinary(ReceivingTaskSchema, record.bytes);
    const gate = readInboundYardGate(read, task, CUSTOMER.organizationId);
    task.dockSchedule = undefined;
    task.unloadingPointId = undefined;
    task.yardAdmissionStatus = gate === YardAdmissionStatus.ADMITTED ? YardAdmissionStatus.WAITING_DOCK : gate;
    warehouseInbound.set(record.id, TABLE_DEFINITIONS.warehouseInbound.encode({ ...record, bytes: toBinary(ReceivingTaskSchema, task) }));
  }

  const equipment = createSeedWarehouseEquipment(snapshot.meta.worldTimeMs, WAREHOUSE_YARD_MORNING);
  const warehouseEquipment = new Map(snapshot.collections.warehouseEquipment);
  warehouseEquipment.set(equipment.id, TABLE_DEFINITIONS.warehouseEquipment.encode(equipment));

  return { ...snapshot, collections: { ...snapshot.collections, warehouseEquipment, warehouseInbound } };
};

export const createMorningYardReplayTasks = (runtime: IModuleRuntime): readonly SchedulerTaskValue[] => [{
  id: 'morning-yard-seed-payments',
  intervalMs: 1,
  isCoalesced: true,
  runCommands: async (): Promise<void> => {
    const { runPaymentTask } = await loadPayments();
    await runtime.command((transaction) => {
      runPaymentTask(runtime, transaction);
    });
  },
}];
