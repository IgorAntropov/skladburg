import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  PaymentService,
  PayoutStatus,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
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

vi.mock('../../api/commands/useDealCommandAccess', () => ({
  useDealApprovalAccess: () => ({ access: { status: 'allowed' } }),
  useDealCommandAccess: () => ({ status: 'allowed' }),
}));

const DEAL_ID = 'f0000010-0000-4000-8000-000000000000';
const deal = create(DealSchema, { customerOrganizationId: TEST_ORGANIZATION_ID, id: DEAL_ID, status: DealStatus.PAID });

const Receipt = ({ value = deal }: { value?: Deal | undefined }): null | ReactElement => {
  const { t } = useCatalogSection(dealFolderSection);
  return t === undefined ? null : <DealPayment deal={value} t={t} />;
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

  it.each([
    { deliveryMethod: DeliveryMethod.EXCHANGE, expected: 140_000n, fundedAmount: { amountMinor: 140_000n, currencyCode: 'RUB' } },
    { deliveryMethod: DeliveryMethod.CUSTOMER, expected: 160_000n, fundedAmount: undefined },
  ])('funds delivery $deliveryMethod using the invoice amount', async ({ deliveryMethod, expected, fundedAmount }) => {
    let submitted: bigint | undefined;
    const runtime = createTestRuntime({
      routes: router => router.service(PaymentService, {
        fundDeal: ({ amount }) => {
          submitted = amount?.amountMinor;
          return {};
        },
        getDealPayment: () => ({
          payment: {
            dealId: DEAL_ID,
            deliveryAmount: { amountMinor: 20_000n, currencyCode: 'RUB' },
            fundedAmount,
            goodsAmount: { amountMinor: 140_000n, currencyCode: 'RUB' },
            status: SafeDealPaymentStatus.INVOICED,
            version: 2,
          },
        }),
      }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const value = create(DealSchema, { ...deal, deliveryMethod, status: DealStatus.AWAITING_PAYMENT });

    render(withTestLocalizer(
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}><Receipt value={value} /></QueryClientProvider>
      </ApiRuntimeProvider>,
    ));

    fireEvent.click(await screen.findByTestId('deal-fund'));
    await waitFor(() => {
      expect(submitted).toBe(expected);
    });
  });

  it('shows the projected carrier commission and distinguishes the carrier payout', async () => {
    const supplierPayout = {
      amount: { amountMinor: 118_000n, currencyCode: 'RUB' }, organizationId: TEST_ORGANIZATION_ID, status: PayoutStatus.PAID,
    };
    const carrierPayout = {
      amount: { amountMinor: 19_700n, currencyCode: 'RUB' },
      organizationId: 'f0000010-0000-4000-8000-000000000001',
      status: PayoutStatus.PAID,
    };
    const runtime = createTestRuntime({
      routes: router => router.service(PaymentService, {
        getDealPayment: () => ({
          payment: {
            dealId: DEAL_ID,
            payouts: [supplierPayout, carrierPayout],
            status: SafeDealPaymentStatus.PAID_OUT,
            transport: {
              carrierPayout,
              commissionAmount: { amountMinor: 300n, currencyCode: 'RUB' },
              commissionRateBasisPoints: 150,
              shippingAmount: { amountMinor: 20_000n, currencyCode: 'RUB' },
            },
            version: 4,
          },
        }),
      }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const value = create(DealSchema, { ...deal, deliveryMethod: DeliveryMethod.EXCHANGE });

    render(withTestLocalizer(
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}><Receipt value={value} /></QueryClientProvider>
      </ApiRuntimeProvider>,
    ));

    expect((await screen.findByTestId('deal-payment-transport-commission')).textContent).toMatch(/^3\s*₽$/u);
    expect(screen.getByTestId('deal-payment-carrier-payout').textContent).toMatch(/^197\s*₽$/u);
    expect(screen.getAllByTestId('deal-payment-payout')).toHaveLength(1);
  });
});
