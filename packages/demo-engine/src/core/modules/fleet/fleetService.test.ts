import type { MessageInitShape } from '@bufbuild/protobuf';
import type { Client } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  FleetService,
  type SaveCarrierLaneRequest,
  SaveCarrierLaneRequestSchema,
  type SaveVehicleRequest,
  SaveVehicleRequestSchema,
  type VehicleAvailabilitySchema,
  VehicleBodyType,
  VehicleCargoKind,
  type VehicleDetailsSchema,
} from '@skladburg/contracts/fleet/v1/fleet';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { TestRuntimeValue } from '../testing/testRuntime';

import {
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/seedIds';
import { captureFailure } from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { createFleetService } from './index';

const CARRIER_ONE = callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1);
const CARRIER_TWO = callAs(SeedUserId.ADMIN_8, SeedOrganizationId.CARRIER_2);
const SUPPLIER = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
const REGISTRATION = 'Х921НК 000';

interface FleetHarnessValue extends TestRuntimeValue {
  fleet: Client<typeof FleetService>;
}

const createFleetHarness = (): FleetHarnessValue => {
  const harness = createTestRuntime();
  const transport = createRouterTransport(router => router.service(FleetService, createFleetService(harness.runtime)));

  return { ...harness, fleet: createClient(FleetService, transport) };
};

const makeVehicle = (
  harness: FleetHarnessValue,
  details: MessageInitShape<typeof VehicleDetailsSchema> = {},
): SaveVehicleRequest => create(SaveVehicleRequestSchema, {
  details: {
    bodyType: VehicleBodyType.REFRIGERATED,
    cargoKinds: [VehicleCargoKind.GENERAL],
    heightMillimeters: 2600,
    lengthMillimeters: 13600,
    palletPlaces: 33,
    payloadGrams: 22_000_000n,
    registrationNumber: REGISTRATION,
    volumeCubicCentimeters: 85_000_000n,
    widthMillimeters: 2400,
    ...details,
  },
  idempotencyKey: harness.random.uuid(),
  vehicleId: harness.random.uuid(),
});

const makeLane = (
  harness: FleetHarnessValue,
  overrides: Omit<MessageInitShape<typeof SaveCarrierLaneRequestSchema>, '$typeName'> = {},
): SaveCarrierLaneRequest => create(SaveCarrierLaneRequestSchema, {
  carrierLaneId: harness.random.uuid(),
  departureWeekdays: [1, 4, 7],
  fromCityId: SeedCityId.KAZAN,
  idempotencyKey: harness.random.uuid(),
  isActive: true,
  tariff: { amountMinor: 9_007_199_254_740_993n, currencyCode: 'RUB' },
  toCityId: SeedCityId.KAZAN,
  ...overrides,
});

const makeWindow = (startsAtNanos: number, endsAtNanos: number): MessageInitShape<typeof VehicleAvailabilitySchema> => ({
  cityId: SeedCityId.MOSCOW,
  endsAt: { nanos: endsAtNanos, seconds: 1_800_000_000n },
  startsAt: { nanos: startsAtNanos, seconds: 1_800_000_000n },
});

describe('FleetService', () => {
  it('keeps lists and page cursors within the caller fleet and rejects a supplier without fleet_view', async () => {
    const harness = createFleetHarness();
    const { fleet } = harness;
    const own = await fleet.saveVehicle(makeVehicle(harness), CARRIER_ONE);
    await fleet.saveVehicle(makeVehicle(harness, { registrationNumber: 'Х922НК 000' }), CARRIER_ONE);
    const foreign = await fleet.saveVehicle(makeVehicle(harness), CARRIER_TWO);
    const page = await fleet.listVehicles({ page: { pageSize: 1 } }, CARRIER_ONE);
    const next = await fleet.listVehicles({ page: { pageSize: 1, pageToken: page.page?.nextPageToken } }, CARRIER_ONE);
    const all = await fleet.listVehicles({}, CARRIER_ONE);
    const failure = await captureFailure(fleet.listVehicles({ page: { pageToken: foreign.vehicle?.id } }, CARRIER_ONE));
    const supplier = readErrorDetail(await captureError(fleet.listVehicles({}, SUPPLIER)));

    expect(page.vehicles).toHaveLength(1);
    expect(next.vehicles).toHaveLength(1);
    expect(next.vehicles[0]?.id).not.toBe(page.vehicles[0]?.id);
    expect(all.vehicles).toContainEqual(own.vehicle);
    expect(all.vehicles.every(vehicle => vehicle.tenantId === SeedOrganizationId.CARRIER_1)).toBe(true);
    expect(failure.violations).toEqual([{ fieldPath: 'page.page_token', ruleId: 'page_token.invalid' }]);
    expect(supplier.params).toMatchObject({ case: 'permissionDenied', value: { permission: 'fleet_view' } });
  });

  it('keeps foreign writes private even when expected version is zero and requires fleet_edit', async () => {
    const harness = createFleetHarness();
    const { fleet } = harness;
    const request = makeVehicle(harness);
    await fleet.saveVehicle(request, CARRIER_TWO);
    const foreign = await captureFailure(fleet.saveVehicle(request, CARRIER_ONE));
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CARRIER_1,
      permissions: ['fleet_view'],
      warehouseIds: [],
    });
    const readOnly = callAs(userId, SeedOrganizationId.CARRIER_1);
    const denied = readErrorDetail(await captureError(fleet.saveVehicle(makeVehicle(harness), readOnly)));

    expect(foreign).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.VEHICLE });
    expect(denied.params).toMatchObject({ case: 'permissionDenied', value: { permission: 'fleet_edit' } });
    expect(harness.state.read.get('vehicles', request.vehicleId)?.tenantId).toBe(SeedOrganizationId.CARRIER_2);
  });

  it('replays successful saves, rejects changed bodies under the same key and detects stale versions', async () => {
    const harness = createFleetHarness();
    const { fleet } = harness;
    const request = makeVehicle(harness, { registrationNumber: '  х921нк   000  ' });
    const first = await fleet.saveVehicle(request, CARRIER_ONE);
    const replay = await fleet.saveVehicle(request, CARRIER_ONE);
    const changedReplay = await captureFailure(fleet.saveVehicle({ ...request, expectedVersion: 1n }, CARRIER_ONE));
    const updated = await fleet.saveVehicle({ ...request, expectedVersion: 1n, idempotencyKey: harness.random.uuid() }, CARRIER_ONE);
    const stale = await captureFailure(fleet.saveVehicle({
      ...request,
      expectedVersion: 1n,
      idempotencyKey: harness.random.uuid(),
    }, CARRIER_ONE));

    expect(first.vehicle).toMatchObject({ details: { registrationNumber: REGISTRATION }, version: 1n });
    expect(replay).toEqual(first);
    expect(changedReplay.code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    expect(updated.vehicle?.version).toBe(2n);
    expect(stale).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 2, entity: EntityKind.VEHICLE });
  });

  it('validates demo numbers and enforces uniqueness only within the fleet', async () => {
    const harness = createFleetHarness();
    const { fleet } = harness;
    await fleet.saveVehicle(makeVehicle(harness), CARRIER_ONE);
    await fleet.saveVehicle(makeVehicle(harness), CARRIER_TWO);
    const duplicate = await captureFailure(fleet.saveVehicle(makeVehicle(harness, { registrationNumber: 'х921нк 000' }), CARRIER_ONE));
    const realSuffix = await captureFailure(fleet.saveVehicle(makeVehicle(harness, { registrationNumber: 'Х921НК 999' }), CARRIER_ONE));

    expect(duplicate.violations).toEqual([{ fieldPath: 'details.registration_number', ruleId: 'fleet.registration_number_taken' }]);
    expect(realSuffix.violations).toEqual([{ fieldPath: 'details.registration_number', ruleId: 'fleet.registration_number_demo' }]);
  });

  it('allows adjacent windows down to nanoseconds and rejects an overlap even between different cities', async () => {
    const harness = createFleetHarness();
    const { fleet } = harness;
    const first = makeWindow(1, 2);
    const adjacent = { ...makeWindow(2, 3), cityId: SeedCityId.KAZAN };
    const request = makeVehicle(harness, { availability: [adjacent, first] });
    const response = await fleet.saveVehicle(request, CARRIER_ONE);
    const overlap = makeVehicle(harness, { availability: [makeWindow(1, 3), adjacent] });
    const failure = await captureFailure(fleet.saveVehicle({
      ...overlap,
      expectedVersion: 1n,
      vehicleId: request.vehicleId,
    }, CARRIER_ONE));

    expect(response.vehicle?.details?.availability).toHaveLength(2);
    expect(failure.violations).toEqual([{ fieldPath: 'details.availability[1].starts_at', ruleId: 'fleet.availability_overlap' }]);
    expect(harness.state.read.get('vehicles', request.vehicleId)?.version).toBe(1n);
  });

  it.each([
    {
      description: 'one billion nanoseconds in the start',
      endsAt: { nanos: 0, seconds: 1n },
      field: 'starts_at',
      startsAt: { nanos: 1_000_000_000, seconds: 0n },
    },
    {
      description: 'negative nanoseconds in the end',
      endsAt: { nanos: -1, seconds: 1n },
      field: 'ends_at',
      startsAt: { nanos: 999_999_999, seconds: 0n },
    },
    {
      description: 'a start before year 1',
      endsAt: { nanos: 0, seconds: -62_135_596_800n },
      field: 'starts_at',
      startsAt: { nanos: 999_999_999, seconds: -62_135_596_801n },
    },
    {
      description: 'an end after year 9999',
      endsAt: { nanos: 0, seconds: 253_402_300_800n },
      field: 'ends_at',
      startsAt: { nanos: 999_999_999, seconds: 253_402_300_799n },
    },
  ])('rejects an availability window with $description', async ({ endsAt, field, startsAt }) => {
    const harness = createFleetHarness();
    const request = makeVehicle(harness, { availability: [{ cityId: SeedCityId.MOSCOW, endsAt, startsAt }] });
    const failure = await captureFailure(harness.fleet.saveVehicle(request, CARRIER_ONE));

    expect(failure.violations).toEqual([{ fieldPath: `details.availability[0].${field}`, ruleId: 'fleet.timestamp_invalid' }]);
    expect(harness.state.read.get('vehicles', request.vehicleId)).toBeUndefined();
  });

  it('validates known cities, time order and the temperature required by controlled cargo', async () => {
    const harness = createFleetHarness();
    const { fleet } = harness;
    const failure = await captureFailure(fleet.saveVehicle(makeVehicle(harness, {
      availability: [{ ...makeWindow(2, 2), cityId: harness.random.uuid() }],
      cargoKinds: [VehicleCargoKind.TEMPERATURE_CONTROLLED],
    }), CARRIER_ONE));
    const inverted = await captureFailure(fleet.saveVehicle(makeVehicle(harness, {
      cargoKinds: [VehicleCargoKind.TEMPERATURE_CONTROLLED],
      temperature: { maxCelsius: -5, minCelsius: 0 },
    }), CARRIER_ONE));

    expect(failure.violations).toEqual(expect.arrayContaining([
      { fieldPath: 'details.availability[0].city_id', ruleId: 'fleet.city_exists' },
      { fieldPath: 'details.availability[0].ends_at', ruleId: 'fleet.availability_order' },
      { fieldPath: 'details.temperature', ruleId: 'fleet.temperature_required' },
    ]));
    expect(inverted.violations).toEqual([{ fieldPath: 'details.temperature.max_celsius', ruleId: 'fleet.temperature_range_order' }]);
  });

  it('saves and lists trimmed driver names only in their own organization', async () => {
    const harness = createFleetHarness();
    const { fleet } = harness;
    const request = {
      displayName: '  Арсений Леснов  ',
      driverId: harness.random.uuid(),
      idempotencyKey: harness.random.uuid(),
      isActive: true,
    };
    const created = await fleet.saveDriver(request, CARRIER_ONE);
    const foreign = await captureFailure(fleet.saveDriver({ ...request, expectedVersion: 1n }, CARRIER_TWO));
    const blank = await captureFailure(fleet.saveDriver({
      ...request,
      displayName: '   ',
      driverId: harness.random.uuid(),
      idempotencyKey: harness.random.uuid(),
    }, CARRIER_ONE));
    const ownList = await fleet.listDrivers({}, CARRIER_ONE);
    const foreignList = await fleet.listDrivers({}, CARRIER_TWO);

    expect(created.driver).toMatchObject({ displayName: 'Арсений Леснов', isActive: true, version: 1n });
    expect(foreign).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.DRIVER });
    expect(blank.violations).toEqual([{ fieldPath: 'display_name', ruleId: 'string.min_len' }]);
    expect(ownList.drivers).toContainEqual(created.driver);
    expect(foreignList.drivers.every(driver => driver.tenantId === SeedOrganizationId.CARRIER_2)).toBe(true);
  });

  it('accepts routes inside a city, keeps directed lanes unique and preserves exact minor units', async () => {
    const harness = createFleetHarness();
    const { fleet } = harness;
    const request = makeLane(harness);
    const local = await fleet.saveCarrierLane(request, CARRIER_ONE);
    const duplicate = await captureFailure(fleet.saveCarrierLane(makeLane(harness), CARRIER_ONE));
    const foreign = await captureFailure(fleet.saveCarrierLane(request, CARRIER_TWO));
    const forward = await fleet.saveCarrierLane(makeLane(harness, { toCityId: SeedCityId.MOSCOW }), CARRIER_ONE);
    const reverse = await fleet.saveCarrierLane(makeLane(harness, { fromCityId: SeedCityId.MOSCOW }), CARRIER_ONE);
    const list = await fleet.listCarrierLanes({}, CARRIER_ONE);

    expect(local.carrierLane?.tariff?.amountMinor).toBe(9_007_199_254_740_993n);
    expect(duplicate.violations).toEqual([{ fieldPath: 'to_city_id', ruleId: 'fleet.carrier_lane_taken' }]);
    expect(foreign).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.CARRIER_LANE });
    expect(list.carrierLanes).toEqual(expect.arrayContaining([local.carrierLane, forward.carrierLane, reverse.carrierLane]));
    expect(list.carrierLanes.every(lane => lane.tenantId === SeedOrganizationId.CARRIER_1)).toBe(true);
  });

  it('rejects unknown cities and currencies other than RUB for carrier lanes', async () => {
    const harness = createFleetHarness();
    const failure = await captureFailure(harness.fleet.saveCarrierLane(makeLane(harness, {
      tariff: { amountMinor: 1n, currencyCode: 'USD' },
      toCityId: harness.random.uuid(),
    }), CARRIER_ONE));

    expect(failure.violations).toEqual(expect.arrayContaining([
      { fieldPath: 'to_city_id', ruleId: 'fleet.city_exists' },
      { fieldPath: 'tariff.currency_code', ruleId: 'money.currency_unsupported' },
    ]));
  });

  it('allows retrying the same save after an atomic storage failure', async () => {
    const harness = createFleetHarness();
    const request = makeVehicle(harness);
    const commit = vi.spyOn(harness.storage, 'commit').mockRejectedValueOnce(new Error('Storage unavailable'));
    const failure = await captureFailure(harness.fleet.saveVehicle(request, CARRIER_ONE));
    const afterFailure = harness.state.read.get('vehicles', request.vehicleId);
    const retry = await harness.fleet.saveVehicle(request, CARRIER_ONE);
    const replay = await harness.fleet.saveVehicle(request, CARRIER_ONE);

    expect(failure.code).toBe(ErrorCode.UNAVAILABLE);
    expect(afterFailure).toBeUndefined();
    expect(retry.vehicle?.version).toBe(1n);
    expect(replay).toEqual(retry);
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
