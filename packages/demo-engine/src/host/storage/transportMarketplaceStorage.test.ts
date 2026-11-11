import 'fake-indexeddb/auto';
import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  type Deal,
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  FleetService,
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';
import {
  LogisticsService,
  type SelectTransportOfferRequest,
} from '@skladburg/contracts/logistics/v1/logistics';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import { IDBFactory } from 'fake-indexeddb';
import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { EngineSnapshotValue } from '../../core/ports/index';

import {
  createEngine,
  type IDemoEngine,
} from '../../core/engine/index';
import {
  createEngineTransport,
  createFakeRealTime,
} from '../../core/engine/testing/engineHarness';
import {
  CARRIER_CALL,
  CUSTOMER_CALL,
  SUPPLIER_6_CALL,
} from '../../core/modules/catalog/showcase/testing/showcaseFixtures';
import {
  buildRub,
  nextUuid,
} from '../../core/modules/catalog/testing/catalogFixtures';
import {
  createMemoryStorage,
  ENGINE_COLLECTION_NAMES,
} from '../../core/ports/index';
import {
  SeedCityId,
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../core/seed/index';
import {
  ENGINE_SCHEMA_VERSION,
  TABLE_DEFINITIONS,
} from '../../core/state/index';
import { createIndexedDbStorage } from './indexedDbStorage';

const DATABASE_NAME = 'transport-marketplace';
const LEGACY_DATABASE_VERSION = 14;
const LEGACY_SCHEMA_VERSION = 16;
const DEAL_ID = 'e0000000-0000-4000-8000-000000000001';
const DRIVER_ID = 'e0000000-0000-4000-8000-000000000002';
const RATE = buildRub(650_000n);

const createLegacyDatabase = (
  factory: IDBFactory,
  snapshot: EngineSnapshotValue,
  databaseVersion = LEGACY_DATABASE_VERSION,
  schemaVersion = LEGACY_SCHEMA_VERSION,
): Promise<void> => new Promise((resolve, reject) => {
  const request = factory.open(DATABASE_NAME, databaseVersion);

  request.addEventListener('upgradeneeded', () => {
    const laterCollections = ['stockBalances', 'stockBatches', 'stockMovements'];
    if (databaseVersion < 17) {
      laterCollections.push('warehouseTopologies');
    }
    if (databaseVersion === LEGACY_DATABASE_VERSION) {
      laterCollections.push('transportOffers', 'transportRequests', 'trips');
    }
    const database = request.result;

    for (const name of ENGINE_COLLECTION_NAMES) {
      if (laterCollections.includes(name)) {
        continue;
      }

      const store = database.createObjectStore(name);
      for (const [key, record] of snapshot.collections[name]) {
        store.put(record, key);
      }
    }

    const meta = database.createObjectStore('meta');
    meta.put(schemaVersion, 'schemaVersion');
    meta.put(snapshot.meta, 'engineMeta');
  });
  request.addEventListener('success', () => {
    request.result.close();
    resolve();
  });
  request.addEventListener('error', () => {
    reject(request.error ?? new Error('The legacy database did not open'));
  });
});

const prepareDeal = async (engine: IDemoEngine): Promise<Deal> => {
  const deal = createClient(DealService, createEngineTransport(engine, true));
  const { deal: draft } = await deal.createDealDraft({
    dealId: DEAL_ID,
    desiredDate: { day: 13, month: 10, year: 2026 },
    idempotencyKey: nextUuid(),
    lines: [{ listingId: 'd1060003-0000-4000-8000-000000000000', quantity: 240_000n }],
    shipFromCityId: SeedCityId.MOSCOW,
    shipToWarehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
    supplierOrganizationId: SeedOrganizationId.SUPPLIER_6,
  }, CUSTOMER_CALL);
  const { deal: submitted } = await deal.submitDeal({
    dealId: DEAL_ID,
    expectedVersion: draft?.version,
    goodsTotal: draft?.goodsTotal,
    idempotencyKey: nextUuid(),
  }, CUSTOMER_CALL);
  const { deal: agreed } = await deal.confirmDeal({
    dealId: DEAL_ID,
    expectedVersion: submitted?.version,
    goodsTotal: submitted?.goodsTotal,
    idempotencyKey: nextUuid(),
    shipFromWarehouseId: SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1,
  }, SUPPLIER_6_CALL);
  if (agreed === undefined) {
    throw new Error('Expected an agreed deal');
  }

  return agreed;
};

const selectCarrier = async (engine: IDemoEngine, deal: Deal): Promise<Omit<SelectTransportOfferRequest, '$typeName'>> => {
  const logistics = createClient(LogisticsService, createEngineTransport(engine, true));
  const { transportRequest } = await logistics.publishTransportRequest({
    cargo: {
      bodyTypes: [VehicleBodyType.REFRIGERATED],
      cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED,
      heightMillimeters: 1000,
      lengthMillimeters: 1200,
      palletPlaces: 1,
      temperature: { maxCelsius: 4, minCelsius: 2 },
      volumeCubicCentimeters: 960_000n,
      weightGrams: 300_000n,
      widthMillimeters: 800,
    },
    dealId: deal.id,
    deliveryWindow: {
      endsAt: timestampFromMs(Date.UTC(2026, 9, 13, 8, 15)),
      startsAt: timestampFromMs(Date.UTC(2026, 9, 13, 8, 5)),
    },
    expectedVersion: deal.version,
    idempotencyKey: nextUuid(),
    pickupWindow: {
      endsAt: timestampFromMs(Date.UTC(2026, 9, 13, 7, 20)),
      startsAt: timestampFromMs(Date.UTC(2026, 9, 13, 7)),
    },
  }, CUSTOMER_CALL);
  if (transportRequest?.summary === undefined || transportRequest.perspective.case !== 'deal') {
    throw new Error('Expected a deal-side transport request');
  }
  expect(transportRequest.summary).toMatchObject({ fromCityId: SeedCityId.MOSCOW, toCityId: SeedCityId.MOSCOW });
  const transportRequestId = transportRequest.summary.id;
  const { offer } = await logistics.submitTransportOffer({
    amount: RATE,
    idempotencyKey: nextUuid(),
    transportRequestId,
  }, CARRIER_CALL);
  if (offer === undefined) {
    throw new Error('Expected a carrier offer');
  }

  const selection = {
    confirmedAmount: RATE,
    expectedVersion: transportRequest.perspective.value.version,
    idempotencyKey: nextUuid(),
    transportOfferId: offer.id,
    transportRequestId,
  };
  const selected = await logistics.selectTransportOffer(selection, CUSTOMER_CALL);
  expect(selected.transportRequest?.summary?.status).toBe(TransportRequestStatus.SELECTED);

  return selection;
};

it('preserves the pre-marketplace database and reloads a selected offer after reopening it', async () => {
  const factory = new IDBFactory();
  const realTime = createFakeRealTime();
  const sourceStorage = createMemoryStorage();
  const source = await createEngine({ epoch: 'legacy-world', realTime, storage: sourceStorage });
  const deal = await prepareDeal(source);
  const fleet = createClient(FleetService, createEngineTransport(source, true));
  await fleet.saveDriver({
    displayName: 'Тестовый водитель',
    driverId: DRIVER_ID,
    expectedVersion: 0n,
    idempotencyKey: nextUuid(),
    isActive: true,
  }, CARRIER_CALL);
  const original = await sourceStorage.load();
  if (original === undefined) {
    throw new Error('Expected the legacy world snapshot');
  }
  expect(original.collections.drivers.has(DRIVER_ID)).toBe(true);
  expect(original.collections.documents.size).toBeGreaterThan(0);
  expect(original.collections.payments.size).toBeGreaterThan(0);
  await createLegacyDatabase(factory, original);

  const migratedStorage = await createIndexedDbStorage({ databaseName: DATABASE_NAME, factory });
  let selection: Omit<SelectTransportOfferRequest, '$typeName'>;
  try {
    const engine = await createEngine({ epoch: 'migrated-world', realTime, storage: migratedStorage });
    expect(await migratedStorage.load()).toEqual({ ...original, schemaVersion: ENGINE_SCHEMA_VERSION });
    selection = await selectCarrier(engine, deal);
  }
  finally {
    migratedStorage.close();
  }

  const reopenedStorage = await createIndexedDbStorage({ databaseName: DATABASE_NAME, factory });
  try {
    const engine = await createEngine({ epoch: 'reopened-world', realTime, storage: reopenedStorage });
    const transport = createEngineTransport(engine, true);
    const logistics = createClient(LogisticsService, transport);
    const { transportOfferId, transportRequestId } = selection;
    const { transportRequest } = await logistics.getTransportRequest({ transportRequestId }, CUSTOMER_CALL);
    expect(transportRequest).toMatchObject({
      perspective: {
        case: 'deal',
        value: { selectedOffer: { amount: RATE, carrierOrganizationId: SeedOrganizationId.CARRIER_1, id: transportOfferId } },
      },
      summary: { id: transportRequestId, status: TransportRequestStatus.SELECTED },
    });
    const replay = await logistics.selectTransportOffer(selection, CUSTOMER_CALL);
    expect(replay.transportRequest).toEqual(transportRequest);
    const deals = createClient(DealService, transport);
    expect((await deals.getDeal({ dealId: deal.id }, CUSTOMER_CALL)).deal?.status).toBe(DealStatus.AWAITING_LOGISTICS);
  }
  finally {
    reopenedStorage.close();
  }
});

describe('saved world migration with an active trip', () => {
  const realTime = createFakeRealTime();
  let original: EngineSnapshotValue;

  beforeAll(async () => {
    const sourceStorage = createMemoryStorage();
    const source = await createEngine({ epoch: 'source', realTime, storage: sourceStorage });
    const deal = await prepareDeal(source);
    const selection = await selectCarrier(source, deal);
    const stored = await sourceStorage.load();

    if (stored === undefined) {
      throw new Error('Expected the source snapshot');
    }

    expect(stored.collections.trips.has(selection.transportRequestId)).toBe(true);
    expect(stored.collections.idempotency.size).toBeGreaterThan(0);
    original = stored;
  });

  it.each([
    { databaseVersion: 16, schemaVersion: 18 },
    { databaseVersion: 17, schemaVersion: 19 },
  ])('rolls back a failed migration from schema $schemaVersion and keeps the trip after retry', async ({
    databaseVersion,
    schemaVersion,
  }) => {
    const factory = new IDBFactory();
    const warehouseTopologies = new Map(original.collections.warehouseTopologies);
    if (databaseVersion === 17) {
      const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
      const raw = warehouseTopologies.get(warehouseId);

      if (raw === undefined) {
        throw new Error('Expected the topology to be stored');
      }

      const table = TABLE_DEFINITIONS.warehouseTopologies;
      const record = table.decode(raw);
      const topology = fromBinary(WarehouseTopologySchema, record.topologyBytes);
      topology.revision = 7;
      warehouseTopologies.set(warehouseId, table.encode({ ...record, topologyBytes: toBinary(WarehouseTopologySchema, topology) }));
    }
    const expected = { ...original, collections: { ...original.collections, warehouseTopologies } };
    const old = {
      ...expected,
      collections: { ...expected.collections, warehouseTopologies: databaseVersion === 17 ? warehouseTopologies : new Map() },
      schemaVersion,
    };
    await createLegacyDatabase(factory, old, databaseVersion, schemaVersion);
    const storage = await createIndexedDbStorage({ databaseName: DATABASE_NAME, factory });

    try {
      expect(await storage.load()).toEqual(old);
      const replaceAll = storage.replaceAll;
      vi.spyOn(storage, 'replaceAll').mockImplementationOnce(next => replaceAll({
        ...next,
        collections: {
          ...next.collections,
          stockBalances: new Map([['unclonable', new Proxy({}, {})]]),
        },
      }));

      await expect(createEngine({ epoch: 'failed', realTime, storage })).rejects.toMatchObject({ name: 'SeedLoadError' });
      expect(await storage.load()).toEqual(old);

      await createEngine({ epoch: 'migrated', realTime, storage });
      expect(await storage.load()).toEqual(expected);
    }
    finally {
      storage.close();
    }

    const reopened = await createIndexedDbStorage({ databaseName: DATABASE_NAME, factory });

    try {
      await createEngine({ epoch: 'reopened', realTime, storage: reopened });
      expect(await reopened.load()).toEqual(expected);
    }
    finally {
      reopened.close();
    }
  });
});
