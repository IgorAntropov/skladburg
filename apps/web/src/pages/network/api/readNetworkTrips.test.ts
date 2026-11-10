import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ClockService,
  GetWorldClockResponseSchema,
} from '@skladburg/contracts/clock/v1/clock';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  ListTripsResponseSchema,
  LogisticsService,
  TripSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  GetOrganizationShowcaseResponseSchema,
  OrganizationShowcaseService,
} from '@skladburg/contracts/organization/v1/showcase';
import {
  expect,
  it,
  vi,
} from 'vitest';

import { createQueryClient } from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';

import { readNetworkTrips } from './readNetworkTrips';

const CARRIER_ID = '41000000-0000-4000-8000-000000000001';
const clockReading = create(GetWorldClockResponseSchema, { timeScale: 0, worldTime: timestampFromMs(30_000) });
const carrierShowcase = create(GetOrganizationShowcaseResponseSchema, {
  organization: { id: CARRIER_ID, logo: { lightUrl: 'logos/carrier.svg' }, name: 'Демо-перевозчик' },
});
const route = create(TripSchema, {
  delivery: { mapNodeId: 'destination', warehouseId: 'second' },
  id: 'trip-1',
  mapTrack: { carrierOrganizationId: CARRIER_ID, registrationNumber: 'А001АА 000', routeLegIds: ['first-leg'] },
  pickup: { mapNodeId: 'origin', warehouseId: 'first' },
  plannedArrivalAt: timestampFromMs(60_000),
  plannedDepartureAt: timestampFromMs(0),
  status: TripStatus.IN_TRANSIT,
});

it('shares the carrier read across active trips and uses the world clock for the scene', async () => {
  const listTrips = vi.fn(() => create(ListTripsResponseSchema, {
    trips: [
      route,
      { ...route, id: 'trip-2' },
      { ...route, id: 'trip-3', status: TripStatus.CLOSED },
    ],
  }));
  const getOrganizationShowcase = vi.fn(() => carrierShowcase);
  const getWorldClock = vi.fn(() => clockReading);
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(LogisticsService, { listTrips });
      router.service(OrganizationShowcaseService, { getOrganizationShowcase });
      router.service(ClockService, { getWorldClock });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });

  const { rows, scene } = await readNetworkTrips(runtime.client, queryClient, TEST_ORGANIZATION_ID, new AbortController().signal);

  expect(getOrganizationShowcase).toHaveBeenCalledOnce();
  expect(getWorldClock).toHaveBeenCalledOnce();
  expect(rows.map(row => row.id)).toEqual(['trip-1', 'trip-2']);
  expect(rows[0]).toMatchObject({
    brandLabel: 'Демо-перевозчик',
    brandLogoPath: 'logos/carrier.svg',
    registrationNumber: 'А001АА 000',
  });
  expect(scene?.actors).toBe(rows);
  expect(scene?.readWorldTimeMs()).toBe(30_000);
  queryClient.clear();
});

it('keeps the list when the clock fails and uses a cached clock when one exists', async () => {
  const getWorldClock = vi.fn((): typeof clockReading => {
    throw new ConnectError('clock unavailable', Code.PermissionDenied, undefined, [
      { desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.PERMISSION_DENIED }) },
    ]);
  });
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(LogisticsService, { listTrips: () => create(ListTripsResponseSchema, { trips: [route] }) });
      router.service(OrganizationShowcaseService, { getOrganizationShowcase: () => carrierShowcase });
      router.service(ClockService, { getWorldClock });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const { signal } = new AbortController();

  const withoutClock = await readNetworkTrips(runtime.client, queryClient, TEST_ORGANIZATION_ID, signal);
  expect(withoutClock.rows).toHaveLength(1);
  expect(withoutClock.scene).toBeUndefined();

  getWorldClock.mockImplementationOnce(() => clockReading);
  await readNetworkTrips(runtime.client, queryClient, TEST_ORGANIZATION_ID, signal);

  const withCachedClock = await readNetworkTrips(runtime.client, queryClient, TEST_ORGANIZATION_ID, signal);
  expect(withCachedClock.scene?.readWorldTimeMs()).toBe(30_000);
  expect(getWorldClock).toHaveBeenCalledTimes(3);
  queryClient.clear();
});

it('discards the result of a read cancelled while waiting for the clock', async () => {
  let resolveClock = (): void => undefined;
  const clock = new Promise<typeof clockReading>((resolve) => {
    resolveClock = (): void => {
      resolve(clockReading);
    };
  });
  const getWorldClock = vi.fn(() => clock);
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(LogisticsService, { listTrips: () => create(ListTripsResponseSchema, { trips: [route] }) });
      router.service(OrganizationShowcaseService, { getOrganizationShowcase: () => carrierShowcase });
      router.service(ClockService, { getWorldClock });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const controller = new AbortController();
  const pending = readNetworkTrips(runtime.client, queryClient, TEST_ORGANIZATION_ID, controller.signal);

  await vi.waitFor(() => {
    expect(getWorldClock).toHaveBeenCalledOnce();
  });
  controller.abort();
  resolveClock();

  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  queryClient.clear();
});

it('returns an empty result when the transport read is forbidden', async () => {
  const getOrganizationShowcase = vi.fn(() => create(GetOrganizationShowcaseResponseSchema));
  const getWorldClock = vi.fn(() => create(GetWorldClockResponseSchema));
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(LogisticsService, {
        listTrips: () => {
          throw new ConnectError('denied', Code.PermissionDenied);
        },
      });
      router.service(OrganizationShowcaseService, { getOrganizationShowcase });
      router.service(ClockService, { getWorldClock });
    },
  });
  const queryClient = createQueryClient({ networkMode: 'always' });

  await expect(readNetworkTrips(runtime.client, queryClient, TEST_ORGANIZATION_ID, new AbortController().signal)).resolves.toEqual({
    rows: [],
    scene: undefined,
  });
  expect(getOrganizationShowcase).not.toHaveBeenCalled();
  expect(getWorldClock).not.toHaveBeenCalled();
  queryClient.clear();
});
