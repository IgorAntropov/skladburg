import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  DealSchema,
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { LiveRegionProvider } from '@/shared/ui';

import { dealInspectorSection } from '../../i18n/inspectorSection';
import { DealInspector } from './DealInspector';

vi.mock('@/entities/session', () => ({
  useCommandAccess: () => ({ status: 'allowed' }),
  useSessionQuery: () => ({ data: undefined }),
}));

vi.mock('./DealTerms', () => ({ DealTerms: () => null }));

const catalog = await dealInspectorSection.load('ru');

const DEAL_ID = 'f0000010-0000-4000-8000-000000000000';
const start = create(DealSchema, { customerOrganizationId: TEST_ORGANIZATION_ID, id: DEAL_ID, status: DealStatus.SUBMITTED, version: 1 });
const cancelled = { ...start, status: DealStatus.CANCELLED, version: 2 };

const draft = create(DealSchema, {
  customerOrganizationId: TEST_ORGANIZATION_ID,
  goodsTotal: { amountMinor: 10_000n, currencyCode: 'RUB' },
  id: DEAL_ID,
  status: DealStatus.DRAFT,
  version: 1,
});
const submitted = { ...draft, status: DealStatus.SUBMITTED, version: 2 };

const renderInspector = (initial: Deal = start): void => {
  const runtime = createTestRuntime({
    routes: router => router.service(DealService, {
      cancelDeal: () => ({ deal: cancelled }),
      submitDeal: () => ({ deal: submitted }),
    }),
  });
  const location = createMemoryLocation('/deals');
  const client = createQueryClient({ networkMode: 'always' });

  const Harness = (): ReactElement => {
    const [deal, setDeal] = useState<Deal>(initial);

    return <DealInspector counterpartyName={undefined} deal={deal} onRefresh={vi.fn()} onUpdated={setDeal} />;
  };

  render(withTestLocalizer(
    <RoutingProvider location={location}>
      <LiveRegionProvider>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={client}>
            <button data-testid="outside-control" type="button" />
            <Harness />
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </LiveRegionProvider>
    </RoutingProvider>,
  ));
};

describe('deal inspector focus', () => {
  afterEach(cleanup);

  it('returns focus to the action that opened the form', async () => {
    renderInspector();
    fireEvent.click(await screen.findByTestId('deal-cancel'));
    fireEvent.click(screen.getByRole('button', { name: catalog['dealInspector.back'] }));

    expect(document.activeElement).toBe(screen.getByTestId('deal-cancel'));
  });

  it('leaves focus on the control the user reached while the command was pending', async () => {
    renderInspector();
    fireEvent.click(await screen.findByTestId('deal-cancel'));
    fireEvent.change(screen.getByRole('textbox', { name: catalog['dealInspector.reason'] }), { target: { value: 'Изменились планы' } });
    fireEvent.click(screen.getByTestId('deal-cancel-submit'));
    const outside = screen.getByTestId('outside-control');
    outside.focus();

    await waitFor(() => {
      expect(screen.getByTestId('deal-status').dataset.status).toBe(String(DealStatus.CANCELLED));
    });
    expect(document.activeElement).toBe(outside);
  });

  it('moves focus to the status after direct submission removes its button', async () => {
    renderInspector(draft);
    fireEvent.click(await screen.findByTestId('deal-submit'));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('deal-status'));
    });
  });

  it('leaves focus outside the action when direct submission completes', async () => {
    renderInspector(draft);
    fireEvent.click(await screen.findByTestId('deal-submit'));
    const outside = screen.getByTestId('outside-control');
    outside.focus();

    await waitFor(() => {
      expect(screen.getByTestId('deal-status').dataset.status).toBe(String(DealStatus.SUBMITTED));
    });
    expect(document.activeElement).toBe(outside);
  });

  it('moves focus to the current status when the command removes the opening action', async () => {
    renderInspector();
    fireEvent.click(await screen.findByTestId('deal-cancel'));
    fireEvent.change(screen.getByRole('textbox', { name: catalog['dealInspector.reason'] }), { target: { value: 'Изменились планы' } });
    fireEvent.click(screen.getByTestId('deal-cancel-submit'));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('deal-status'));
    });
  });
});
