import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  PaymentService,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ApiRuntimeProvider } from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import { useCatalogSection } from '@/shared/i18n';
import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { dealFolderSection } from './dealFolderSection';
import { DealPayment } from './DealPayment';

vi.mock('../../api/commands/useDealCommandAccess', () => ({ useDealCommandAccess: () => ({ status: 'allowed' }) }));

const DEAL_ID = 'f0000010-0000-4000-8000-000000000000';
const deal = create(DealSchema, { customerOrganizationId: TEST_ORGANIZATION_ID, id: DEAL_ID, status: DealStatus.PAID });

const Receipt = (): null | ReactElement => {
  const { t } = useCatalogSection(dealFolderSection);
  return t === undefined ? null : <DealPayment deal={deal} t={t} />;
};

describe('payment receipt access', () => {
  afterEach(cleanup);

  it('keeps a receipt on a transient refresh failure and hides it on a transport-only denial', async () => {
    let error: ConnectError | undefined;
    const runtime = createTestRuntime({
      routes: router => router.service(PaymentService, {
        getDealPayment: () => {
          if (error !== undefined) {
            throw error;
          }
          return { payment: { dealId: DEAL_ID, status: SafeDealPaymentStatus.BLOCKED, version: 2 } };
        },
      }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(withTestLocalizer(
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}><Receipt /></QueryClientProvider>
      </ApiRuntimeProvider>,
    ));
    expect(await screen.findByTestId('deal-payment')).toBeTruthy();

    error = new ConnectError('Temporarily unavailable', Code.Unavailable);
    await act(() => queryClient.refetchQueries());
    expect(screen.getByTestId('deal-payment')).toBeTruthy();

    error = new ConnectError('Permission revoked', Code.PermissionDenied);
    await act(() => queryClient.refetchQueries());
    await waitFor(() => {
      expect(screen.queryByTestId('deal-payment')).toBeNull();
    });
  });
});
