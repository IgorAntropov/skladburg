import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  FleetService,
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';
import {
  TransportOfferSchema,
  TransportRequestRecordSchema,
  TransportRequestStatus,
} from '@skladburg/contracts/logistics/v1/logistics_records';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import {
  SafeDealPaymentRecordSchema,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { EngineSnapshotValue } from '../ports/index';

import { callAs } from '../modules/testing/moduleHarness';
import { createMemoryStorage } from '../ports/index';
import {
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../seed/seedIds';
import { createSeedSnapshot } from '../seed/seedSnapshot';
import { TABLE_DEFINITIONS } from '../state/index';
import { createEngineTransport } from './testing/engineHarness';

const TRIP_DEAL_ID = '00000000-0000-4000-8000-000000000111';
const TRIP_REQUEST_ID = '00000000-0000-4000-8000-000000000112';
const TRIP_OFFER_ID = '00000000-0000-4000-8000-000000000113';

const withSelectedOffer = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const deal = create(DealSchema, {
    customerOrganizationId: SeedOrganizationId.CUSTOMER_1,
    deliveryMethod: DeliveryMethod.EXCHANGE,
    goodsTotal: { amountMinor: 10_000n, currencyCode: 'RUB' },
    id: TRIP_DEAL_ID,
    shipFromWarehouseId: SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1,
    shipToWarehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
    status: DealStatus.AWAITING_LOGISTICS,
    supplierOrganizationId: SeedOrganizationId.SUPPLIER_6,
    version: 2,
  });
  const { worldTimeMs } = snapshot.meta;
  const request = create(TransportRequestRecordSchema, {
    cargo: {
      bodyTypes: [VehicleBodyType.REFRIGERATED],
      cargoKind: VehicleCargoKind.GENERAL,
      heightMillimeters: 1_000,
      lengthMillimeters: 1_000,
      volumeCubicCentimeters: 1_000_000n,
      weightGrams: 1_000n,
      widthMillimeters: 1_000,
    },
    customerOrganizationId: deal.customerOrganizationId,
    dealId: deal.id,
    deliveryWindow: { endsAt: timestampFromMs(worldTimeMs + 10_800_000), startsAt: timestampFromMs(worldTimeMs + 7_200_000) },
    driveMinutes: 60,
    fromCityId: SeedCityId.MOSCOW,
    id: TRIP_REQUEST_ID,
    pickupWindow: { endsAt: timestampFromMs(worldTimeMs + 7_200_000), startsAt: timestampFromMs(worldTimeMs + 3_600_000) },
    publishedAt: timestampFromMs(worldTimeMs),
    selectedOfferId: TRIP_OFFER_ID,
    shipperOrganizationId: deal.supplierOrganizationId,
    status: TransportRequestStatus.SELECTED,
    supplierOrganizationId: deal.supplierOrganizationId,
    toCityId: SeedCityId.MOSCOW,
    version: 2,
  });
  const offer = create(TransportOfferSchema, {
    amount: { amountMinor: 100_000n, currencyCode: 'RUB' },
    carrierOrganizationId: SeedOrganizationId.CARRIER_1,
    id: TRIP_OFFER_ID,
    transportRequestId: request.id,
  });

  return {
    ...snapshot,
    collections: {
      ...snapshot.collections,
      deals: new Map([...snapshot.collections.deals, [deal.id, TABLE_DEFINITIONS.deals.encode(deal)]]),
      transportOffers: new Map([[offer.id, TABLE_DEFINITIONS.transportOffers.encode(offer)]]),
      transportRequests: new Map([[request.id, TABLE_DEFINITIONS.transportRequests.encode(request)]]),
    },
    schemaVersion: 17,
  };
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../modules/payments/loadExchangePayments');
  vi.doUnmock('../seed/seedDealHistory');
  vi.doUnmock('../seed/seedSnapshot');
  vi.restoreAllMocks();
});

describe('engine seed loading', () => {
  it.each([15, 16])('migrates a schema %d world once and preserves it after a failed write', async (schemaVersion) => {
    const { createEngine } = await import('./createEngine');
    const source = createMemoryStorage();
    const realTime = { now: (): number => 0 };
    await createEngine({ epoch: 'source', realTime, storage: source });
    const snapshot = await source.load();
    if (snapshot === undefined) {
      throw new Error('Missing seed snapshot');
    }
    expect(snapshot.collections.deals.size).toBeGreaterThan(0);
    expect(snapshot.collections.documents.size).toBeGreaterThan(0);
    expect(snapshot.collections.payments.size).toBeGreaterThan(0);
    const stored = {
      ...snapshot,
      collections: schemaVersion === 15
        ? { ...snapshot.collections, carrierLanes: new Map(), drivers: new Map(), vehicles: new Map() }
        : snapshot.collections,
      schemaVersion,
    };
    const storage = createMemoryStorage(stored);
    const writeFailure = new Error('Migration write failed');
    const replaceAll = vi.spyOn(storage, 'replaceAll').mockRejectedValueOnce(writeFailure);

    await expect(createEngine({ epoch: 'failed', realTime, storage })).rejects.toMatchObject({
      cause: writeFailure,
      name: 'SeedLoadError',
    });
    expect(await storage.load()).toEqual(stored);

    const engine = await createEngine({ epoch: 'restored', realTime, storage });
    const fleet = createClient(FleetService, createEngineTransport(engine, true));
    const result = await fleet.listVehicles({}, callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1));

    expect(result.vehicles).toHaveLength(3);
    expect(await storage.load()).toEqual(snapshot);
    await createEngine({ epoch: 'reopened', realTime, storage });
    expect(replaceAll).toHaveBeenCalledTimes(2);
  });

  it('restores a selected offer as a draft trip once and preserves the old snapshot if migration cannot write', async () => {
    const { createEngine } = await import('./createEngine');
    const realTime = { now: (): number => 0 };
    const stored = withSelectedOffer(createSeedSnapshot());
    const storage = createMemoryStorage(stored);
    const writeFailure = new Error('Migration write failed');
    const replaceAll = vi.spyOn(storage, 'replaceAll').mockRejectedValueOnce(writeFailure);

    await expect(createEngine({ epoch: 'failed', realTime, storage })).rejects.toMatchObject({
      cause: writeFailure,
      name: 'SeedLoadError',
    });
    expect(await storage.load()).toEqual(stored);

    await createEngine({ epoch: 'restored', realTime, storage });
    const migrated = await storage.load();
    const storedTrip = migrated?.collections.trips.get(TRIP_REQUEST_ID);
    if (storedTrip === undefined || migrated === undefined) {
      throw new Error('Missing migrated trip');
    }
    expect(migrated).toEqual({
      ...stored,
      collections: { ...stored.collections, trips: migrated.collections.trips },
      schemaVersion: 18,
    });
    expect(migrated.collections.trips.size).toBe(1);
    const trip = TABLE_DEFINITIONS.trips.decode(storedTrip);
    expect(trip).toMatchObject({
      dealId: TRIP_DEAL_ID,
      id: TRIP_REQUEST_ID,
      status: TripStatus.AWAITING_CONFIRMATION,
      transportOrder: {
        amount: { amountMinor: 100_000n, currencyCode: 'RUB' },
        carrierOrganizationId: SeedOrganizationId.CARRIER_1,
        delivery: { warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 },
        offerId: TRIP_OFFER_ID,
        pickup: { warehouseId: SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1 },
        shipperOrganizationId: SeedOrganizationId.SUPPLIER_6,
      },
      version: 1,
    });
    expect(trip.assignment).toBeUndefined();
    expect(trip.transportOrder?.confirmedAt).toBeUndefined();

    await createEngine({ epoch: 'reopened', realTime, storage });
    expect(await storage.load()).toEqual(migrated);
    expect(replaceAll).toHaveBeenCalledTimes(2);
  });

  it('preserves the legacy snapshot when the selected offer is missing', async () => {
    const { createEngine } = await import('./createEngine');
    const selected = withSelectedOffer(createSeedSnapshot());
    const stored = { ...selected, collections: { ...selected.collections, transportOffers: new Map() } };
    const storage = createMemoryStorage(stored);
    const replaceAll = vi.spyOn(storage, 'replaceAll');

    await expect(createEngine({ epoch: 'failed', realTime: { now: () => 0 }, storage })).rejects.toMatchObject({ name: 'SeedLoadError' });
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(stored);
  });

  it('preserves the snapshot when the active exchange payment cannot be loaded on startup', async () => {
    const snapshot = createSeedSnapshot();
    const payment = create(SafeDealPaymentRecordSchema, {
      id: TRIP_DEAL_ID,
      payment: { dealId: TRIP_DEAL_ID, status: SafeDealPaymentStatus.BLOCKED },
      transportSettlement: { tripId: TRIP_REQUEST_ID },
    });
    const stored = {
      ...snapshot,
      collections: { ...snapshot.collections, payments: new Map([[payment.id, TABLE_DEFINITIONS.payments.encode(payment)]]) },
    };
    const storage = createMemoryStorage(stored);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    const loadFailure = new Error('The exchange payment chunk is unavailable');
    vi.doMock('../modules/payments/loadExchangePayments', () => ({
      loadExchangePayments: (): Promise<never> => Promise.reject(loadFailure),
    }));
    const { createEngine } = await import('./createEngine');

    await expect(createEngine({ epoch: 'failed', realTime: { now: () => 0 }, storage })).rejects.toMatchObject({
      cause: loadFailure,
      name: 'SeedLoadError',
    });
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(stored);
  });

  it('publishes seeded deal history only on a new world or reset', async () => {
    const { createEngine } = await import('./createEngine');
    const storage = createMemoryStorage();
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    const realTime = { now: (): number => 0 };
    await createEngine({ epoch: 'new', realTime, storage });
    const seeded = await storage.load();

    expect(seeded?.collections.deals.size).toBeGreaterThan(0);
    expect(replaceAll).toHaveBeenCalledTimes(1);

    const restored = await createEngine({ epoch: 'restored', realTime, storage });
    expect(await storage.load()).toEqual(seeded);
    expect(replaceAll).toHaveBeenCalledTimes(1);

    await restored.reset('reset');
    expect(await storage.load()).toEqual(seeded);
    expect(replaceAll).toHaveBeenCalledTimes(2);
  });

  it('serves a city profile for a restored world while preserving its stored deals and documents', async () => {
    const { createEngine } = await import('./createEngine');
    const source = createMemoryStorage();
    const realTime = { now: (): number => 0 };
    await createEngine({ epoch: 'source', realTime, storage: source });
    const snapshot = await source.load();
    const cityRecord = snapshot?.collections.cities.get(SeedCityId.MOSCOW);
    if (snapshot === undefined || cityRecord === undefined) {
      throw new Error('Missing seed city');
    }
    expect(snapshot.collections.deals.size).toBeGreaterThan(0);
    expect(snapshot.collections.documents.size).toBeGreaterThan(0);
    const city = TABLE_DEFINITIONS.cities.decode(cityRecord);
    const cities = new Map(snapshot.collections.cities);
    cities.set(city.id, TABLE_DEFINITIONS.cities.encode({ ...city, localDeliveryProfile: undefined }));
    const stored = { ...snapshot, collections: { ...snapshot.collections, cities } };
    const storage = createMemoryStorage(stored);
    const replaceAll = vi.spyOn(storage, 'replaceAll');

    const engine = await createEngine({ epoch: 'restored', realTime, storage });
    const network = createClient(NetworkService, createEngineTransport(engine, true));
    const response = await network.listCities({}, callAs(SeedUserId.ADMIN_1));

    expect(response.cities.find(item => item.id === city.id)?.localDeliveryProfile).toMatchObject({ distanceKm: 22, driveMinutes: 60 });
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(stored);
  });

  it('preserves an incompatible snapshot when deal history cannot load', async () => {
    const snapshot = createSeedSnapshot();
    const stored = { ...snapshot, meta: { ...snapshot.meta, seedVersion: snapshot.meta.seedVersion - 1 } };
    const storage = createMemoryStorage(stored);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    vi.doMock('../seed/seedDealHistory', () => {
      throw new Error('Deal history chunk is unavailable');
    });
    const { createEngine } = await import('./createEngine');

    await expect(createEngine({ epoch: 'new', realTime: { now: () => 0 }, storage })).rejects.toMatchObject({ name: 'SeedLoadError' });
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(stored);
  });

  it('restores a current snapshot when the seed module cannot be loaded', async () => {
    const snapshot = createSeedSnapshot();
    const storage = createMemoryStorage(snapshot);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    vi.doMock('../seed/seedSnapshot', () => {
      throw new Error('Seed chunk is unavailable');
    });

    const { createEngine } = await import('./createEngine');
    const engine = await createEngine({ epoch: 'restored', realTime: { now: () => 0 }, storage });

    expect(engine.epoch()).toBe('restored');
    expect(engine.listPersonas()).toHaveLength(9);
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(snapshot);
  });

  it('classifies a failed seed import before replacing an incompatible snapshot', async () => {
    const snapshot = createSeedSnapshot();
    const stored = { ...snapshot, meta: { ...snapshot.meta, seedVersion: snapshot.meta.seedVersion - 1 } };
    const storage = createMemoryStorage(stored);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    vi.doMock('../seed/seedSnapshot', () => {
      throw new Error('Seed chunk is unavailable');
    });

    const starting = (async (): Promise<void> => {
      const { createEngine } = await import('./createEngine');
      await createEngine({ epoch: 'new', realTime: { now: () => 0 }, storage });
    })();

    await expect(starting).rejects.toMatchObject({ name: 'SeedLoadError' });
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(stored);
  });

  it('keeps the current world and epoch after a failed reset and allows retrying', async () => {
    const snapshot = createSeedSnapshot();
    const storage = createMemoryStorage(snapshot);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    vi.doMock('../seed/seedSnapshot', () => {
      throw new Error('Seed chunk is unavailable');
    });
    const { createEngine } = await import('./createEngine');
    const seed = { randomSeed: 91, worldStartMs: 10 };
    const engine = await createEngine({ epoch: 'restored', realTime: { now: () => 0 }, seed, storage });
    await engine.checkpoint();
    const stored = await storage.load();
    const clock = engine.getClockSnapshot();
    const personas = engine.listPersonas();

    await expect(engine.reset('reset')).rejects.toMatchObject({ name: 'SeedLoadError' });

    expect(engine.epoch()).toBe('restored');
    expect(engine.getClockSnapshot()).toEqual(clock);
    expect(engine.listPersonas()).toEqual(personas);
    expect(replaceAll).not.toHaveBeenCalled();
    await engine.checkpoint();
    expect(await storage.load()).toEqual(stored);

    vi.doUnmock('../seed/seedSnapshot');
    await engine.reset('retry');

    expect(engine.epoch()).toBe('retry');
    expect(await storage.load()).toEqual(createSeedSnapshot(seed));
  });

  it('does not classify a storage failure as a seed import failure', async () => {
    const storage = createMemoryStorage();
    const failure = new Error('Storage replacement failed');
    vi.spyOn(storage, 'replaceAll').mockRejectedValue(failure);
    const { createEngine } = await import('./createEngine');

    await expect(createEngine({ epoch: 'new', realTime: { now: () => 0 }, storage })).rejects.toBe(failure);
  });

  it('does not classify a seed generation failure as a module import failure', async () => {
    const failure = new Error('Seed generation failed');
    vi.doMock('../seed/seedSnapshot', () => ({
      createSeedSnapshot: (): never => {
        throw failure;
      },
    }));
    const storage = createMemoryStorage();
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    const { createEngine } = await import('./createEngine');

    await expect(createEngine({ epoch: 'new', realTime: { now: () => 0 }, storage })).rejects.toBe(failure);
    expect(replaceAll).not.toHaveBeenCalled();
  });
});
