import type { MessageInitShape } from '@bufbuild/protobuf';
import type { TransportRequestRecord } from '@skladburg/contracts/logistics/v1/logistics_records';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  FleetService,
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import {
  TransportRequestRecordSchema,
  TransportRequestStatus,
} from '@skladburg/contracts/logistics/v1/logistics_records';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IStateTransaction } from '../../state/index';
import type { TestRuntimeValue } from '../testing/testRuntime';

import {
  SEED_WORLD_START_MS,
  SeedCityId,
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
} from '../../seed/index';
import {
  buildRub,
  nextUuid,
} from '../catalog/testing/catalogFixtures';
import {
  callAs,
  createModuleHarness,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { runCarrierBots } from './index';

const RESPONSE_DELAY_MS = 60_000;

const coldRequest = (fields: Omit<MessageInitShape<typeof TransportRequestRecordSchema>, '$typeName'> = {}): TransportRequestRecord =>
  create(TransportRequestRecordSchema, {
    cargo: {
      bodyTypes: [VehicleBodyType.REFRIGERATED],
      cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED,
      heightMillimeters: 250,
      lengthMillimeters: 400,
      palletPlaces: 1,
      temperature: { maxCelsius: 4, minCelsius: 2 },
      volumeCubicCentimeters: 20_000n,
      weightGrams: 10_000n,
      widthMillimeters: 300,
    },
    customerOrganizationId: SeedOrganizationId.CUSTOMER_1,
    dealId: nextUuid(),
    deliveryWindow: { endsAt: timestampFromMs(Date.UTC(2026, 9, 13, 20)), startsAt: timestampFromMs(Date.UTC(2026, 9, 12, 10)) },
    driveMinutes: 970,
    fromCityId: SeedCityId.KRASNODAR,
    id: nextUuid(),
    pickupWindow: { endsAt: timestampFromMs(Date.UTC(2026, 9, 12, 12)), startsAt: timestampFromMs(Date.UTC(2026, 9, 12, 7)) },
    publishedAt: timestampFromMs(SEED_WORLD_START_MS - RESPONSE_DELAY_MS),
    shipperOrganizationId: SeedOrganizationId.CUSTOMER_1,
    status: TransportRequestStatus.OPEN,
    supplierOrganizationId: SeedOrganizationId.SUPPLIER_1,
    toCityId: SeedCityId.MOSCOW,
    version: 1,
    ...fields,
  });

const longRequest = (): TransportRequestRecord => coldRequest({
  cargo: {
    bodyTypes: [VehicleBodyType.LONG_HAUL, VehicleBodyType.LOW_LOADER],
    cargoKind: VehicleCargoKind.OVERSIZE,
    heightMillimeters: 1_000,
    lengthMillimeters: 12_000,
    volumeCubicCentimeters: 12_000_000n,
    weightGrams: 3_000_000n,
    widthMillimeters: 1_000,
  },
  customerOrganizationId: SeedOrganizationId.CUSTOMER_2,
  driveMinutes: 180,
  fromCityId: SeedCityId.CHELYABINSK,
  shipperOrganizationId: SeedOrganizationId.SUPPLIER_3,
  supplierOrganizationId: SeedOrganizationId.SUPPLIER_3,
  toCityId: SeedCityId.YEKATERINBURG,
});

const addRequests = (harness: TestRuntimeValue, ...requests: TransportRequestRecord[]): Promise<void> =>
  harness.runtime.command((transaction) => {
    for (const request of requests) {
      transaction.put('transportRequests', request);
    }
  });

describe('carrier bots', () => {
  it('responds to both seed routes at the delay boundary, using the command to notify only the carrier and shipper', async () => {
    const harness = createTestRuntime();
    const cold = coldRequest();
    const long = longRequest();
    await addRequests(harness, cold, long);

    await runCarrierBots({ ...harness.runtime, getWorldTimeMs: () => SEED_WORLD_START_MS - 1 });

    expect(harness.runtime.read.list('transportOffers')).toEqual([]);
    expect(harness.events).toEqual([]);

    await runCarrierBots(harness.runtime);
    await runCarrierBots(harness.runtime);

    const offers = harness.runtime.read.list('transportOffers');
    expect(offers).toHaveLength(2);
    expect(offers.find(offer => offer.transportRequestId === cold.id)).toMatchObject({
      amount: buildRub(7_500_000n),
      carrierOrganizationId: SeedOrganizationId.CARRIER_1,
      submittedAt: timestampFromMs(SEED_WORLD_START_MS),
    });
    expect(offers.find(offer => offer.transportRequestId === long.id)).toMatchObject({
      amount: buildRub(3_850_000n),
      carrierOrganizationId: SeedOrganizationId.CARRIER_2,
    });
    expect(harness.runtime.read.list('idempotency')).toHaveLength(2);
    expect(harness.events.map(event => [event.channel, event.payload.case])).toEqual([
      [organizationChannel(SeedOrganizationId.CARRIER_1), 'transportRequestChanged'],
      [organizationChannel(SeedOrganizationId.CUSTOMER_1), 'transportRequestChanged'],
      [organizationChannel(SeedOrganizationId.CARRIER_2), 'transportRequestChanged'],
      [organizationChannel(SeedOrganizationId.SUPPLIER_3), 'transportRequestChanged'],
    ]);
  });

  it('skips closed or expired requests and a long load without an available vehicle', async () => {
    const harness = createTestRuntime();
    const closed = coldRequest({ status: TransportRequestStatus.CANCELLED });
    const expired = coldRequest({
      deliveryWindow: { endsAt: timestampFromMs(Date.UTC(2026, 9, 13, 20)), startsAt: timestampFromMs(SEED_WORLD_START_MS) },
      pickupWindow: {
        endsAt: timestampFromMs(SEED_WORLD_START_MS),
        startsAt: timestampFromMs(SEED_WORLD_START_MS - 30_000),
      },
    });
    const long = longRequest();
    await addRequests(harness, closed, expired, long);
    await harness.runtime.command((transaction) => {
      for (const vehicle of transaction.listBy('vehicles', 'tenantId', SeedOrganizationId.CARRIER_2)) {
        const { details } = vehicle;
        if (details !== undefined && details.lengthMillimeters >= 12_000) {
          transaction.put('vehicles', { ...vehicle, details: { ...details, availability: [] } });
        }
      }
    });

    await runCarrierBots(harness.runtime);

    expect(harness.runtime.read.list('transportOffers')).toEqual([]);
    expect(harness.events).toEqual([]);
  });

  it('does not start a command or consume an idempotency key when the carrier has lost the offer permission', async () => {
    const harness = createTestRuntime();
    await addRequests(harness, coldRequest());
    await harness.runtime.command((transaction) => {
      const role = transaction.get('roles', SeedRoleId.DIRECTOR_CARRIER_1);
      if (role === undefined) {
        throw new Error('Expected a carrier role');
      }
      transaction.put('roles', { ...role, permissions: role.permissions.filter(permission => permission !== 'transport_offer_create') });
    });
    const { runtime } = harness;
    const command = vi.spyOn(runtime, 'command');
    const uuid = vi.spyOn(runtime.random, 'uuid');

    await runCarrierBots(runtime);

    expect(harness.runtime.read.list('transportOffers')).toEqual([]);
    expect(command).not.toHaveBeenCalled();
    expect(uuid).not.toHaveBeenCalled();
  });

  it('skips a 12 metre load when the vehicles on the route have 8 metre beds', async () => {
    const harness = createTestRuntime();
    await addRequests(harness, longRequest());
    await harness.runtime.command((transaction) => {
      for (const vehicle of transaction.listBy('vehicles', 'tenantId', SeedOrganizationId.CARRIER_2)) {
        const { details } = vehicle;
        if (details?.availability.some(window => window.cityId === SeedCityId.CHELYABINSK)) {
          transaction.put('vehicles', { ...vehicle, details: { ...details, lengthMillimeters: 8_000 } });
        }
      }
    });

    await runCarrierBots(harness.runtime);

    expect(harness.runtime.read.list('transportOffers')).toEqual([]);
  });

  it('skips a saved zero tariff and still responds to the next request', async () => {
    const harness = createModuleHarness();
    const cold = coldRequest();
    const long = longRequest();
    await addRequests(harness, cold, long);
    const { runtime } = harness;
    const lane = runtime.read.listBy('carrierLanes', 'tenantId', SeedOrganizationId.CARRIER_1)
      .find(candidate => candidate.fromCityId === cold.fromCityId && candidate.toCityId === cold.toCityId);
    if (lane === undefined) {
      throw new Error('Expected the Krasnodar to Moscow lane');
    }

    const fleet = createClient(FleetService, harness.transport);
    await fleet.saveCarrierLane({
      carrierLaneId: lane.id,
      departureWeekdays: lane.departureWeekdays,
      expectedVersion: lane.version,
      fromCityId: lane.fromCityId,
      idempotencyKey: nextUuid(),
      isActive: true,
      tariff: buildRub(0n),
      toCityId: lane.toCityId,
    }, callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1));
    const command = vi.spyOn(runtime, 'command');

    await runCarrierBots(runtime);

    expect(command).toHaveBeenCalledTimes(1);
    expect(runtime.read.list('transportOffers')).toMatchObject([{
      amount: buildRub(3_850_000n),
      carrierOrganizationId: SeedOrganizationId.CARRIER_2,
      transportRequestId: long.id,
    }]);
  });

  it('keeps a manual offer and uses the live tariff from the transaction for the next request', async () => {
    const harness = createModuleHarness();
    const cold = coldRequest();
    const next = coldRequest();
    await addRequests(harness, cold, next);
    const logistics = createClient(LogisticsService, harness.transport);
    const { offer } = await logistics.submitTransportOffer({
      amount: buildRub(4_500_000n),
      idempotencyKey: nextUuid(),
      transportRequestId: cold.id,
    }, callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1));
    const newAmount = buildRub(8_500_050n);
    const { runtime } = harness;
    await runCarrierBots({
      ...runtime,
      command: <TResult>(work: (transaction: IStateTransaction) => TResult): Promise<TResult> => runtime.command((transaction) => {
        const lane = transaction.listBy('carrierLanes', 'tenantId', SeedOrganizationId.CARRIER_1)
          .find(candidate => candidate.fromCityId === SeedCityId.KRASNODAR && candidate.toCityId === SeedCityId.MOSCOW);
        if (lane === undefined) {
          throw new Error('Expected the Krasnodar to Moscow lane');
        }
        transaction.put('carrierLanes', { ...lane, tariff: newAmount });
        return work(transaction);
      }),
    });

    expect(offer?.amount).toEqual(buildRub(4_500_000n));
    expect(harness.runtime.read.listBy('transportOffers', 'transportRequestId', cold.id)).toEqual([offer]);
    expect(harness.runtime.read.listBy('transportOffers', 'transportRequestId', next.id)).toMatchObject([{ amount: newAmount }]);
  });
});
