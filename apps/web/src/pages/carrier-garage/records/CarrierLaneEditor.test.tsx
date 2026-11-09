import type { SaveCarrierLaneRequest } from '@skladburg/contracts/fleet/v1/fleet';

import { create } from '@bufbuild/protobuf';
import {
  CarrierLaneSchema,
  FleetService,
} from '@skladburg/contracts/fleet/v1/fleet';
import { CitySchema } from '@skladburg/contracts/network/v1/network';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { LiveRegionProvider } from '@/shared/ui';

import { CarrierLaneEditor } from './CarrierLaneEditor';

vi.mock('@/entities/session', () => ({ useCommandAccess: () => ({ status: 'allowed' }) }));

const city = create(CitySchema, { id: 'f0000030-0000-4000-8000-000000000000', name: 'Томск' });

const lane = create(CarrierLaneSchema, {
  departureWeekdays: [1],
  fromCityId: city.id,
  id: 'f0000040-0000-4000-8000-000000000000',
  isActive: true,
  tariff: { amountMinor: 25_000n, currencyCode: 'RUB' },
  toCityId: city.id,
  version: 4n,
});

afterEach(cleanup);

it('focuses the weekday error and saves the new ISO days with the exact amount in kopecks', async () => {
  const onRequest = vi.fn<(request: SaveCarrierLaneRequest) => void>();
  const onSaved = vi.fn();
  const runtime = createTestRuntime({
    routes: router => router.service(FleetService, {
      saveCarrierLane: (request) => {
        onRequest(request);

        return { carrierLane: lane };
      },
    }),
  });

  render(withTestLocalizer(
    <RoutingProvider location={createMemoryLocation('/garage')}>
      <LiveRegionProvider>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
            <CarrierLaneEditor cities={[city]} lane={lane} onClose={vi.fn()} onSaved={onSaved} />
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </LiveRegionProvider>
    </RoutingProvider>,
  ));

  const save = await screen.findByTestId('garage-save');
  const monday = screen.getByRole('switch', { name: 'Понедельник' });
  fireEvent.click(monday);
  fireEvent.click(save);

  const daysError = 'Выберите хотя бы один день отправления';
  expect(await screen.findByText(daysError)).toBeTruthy();
  expect(document.activeElement).toBe(monday);
  expect(onRequest).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('switch', { name: 'Среда' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Воскресенье' }));
  expect(screen.queryByText(daysError)).toBeNull();

  const tariff = screen.getByRole('textbox', { name: 'Ставка, ₽' });
  fireEvent.input(tariff, { target: { value: '92 233 720 368 547 758,08' } });
  fireEvent.click(save);

  expect(await screen.findByText('Ставка выходит за допустимый диапазон')).toBeTruthy();
  expect(document.activeElement).toBe(tariff);
  expect(onRequest).not.toHaveBeenCalled();

  fireEvent.input(tariff, { target: { value: '92 233 720 368 547 758,07' } });
  fireEvent.click(save);

  await waitFor(() => {
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  expect(onRequest).toHaveBeenCalledTimes(1);
  expect(onRequest.mock.calls[0]?.[0]).toMatchObject({
    carrierLaneId: lane.id,
    departureWeekdays: [3, 7],
    expectedVersion: 4n,
    fromCityId: city.id,
    isActive: true,
    tariff: { amountMinor: 9_223_372_036_854_775_807n, currencyCode: 'RUB' },
    toCityId: city.id,
  });
});
