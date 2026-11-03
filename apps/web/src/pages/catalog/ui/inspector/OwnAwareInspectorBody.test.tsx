import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  CatalogService,
  GetOwnListingResponseSchema,
  ListingSchema,
  OwnListingSchema,
  ProductSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
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

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { OwnAwareInspectorBody } from './OwnAwareInspectorBody';

vi.mock('../../model/useCatalogTexts', () => ({
  useCatalogTexts: () => ({ listingT: (key: string) => key, t: (key: string) => key }),
}));

vi.mock('./OwnListingDetails', () => ({
  OwnListingDetails: ({ pair }: { pair: { product: { name: string } } }): ReactElement => (
    <div data-testid="own-details">{pair.product.name}</div>
  ),
}));

const LISTING_ID = '00000000-0000-4000-8000-000000000011';

const createApiError = (code: ErrorCode): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code }) }],
);

const renderBody = (
  getOwnListing: () => ReturnType<typeof createOwnResponse>,
  onTitleChange: (title: string | undefined) => void = vi.fn(),
): void => {
  const runtime = createTestRuntime({ routes: router => router.service(CatalogService, { getOwnListing }) });
  const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => withTestLocalizer(
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>,
  );

  render(
    <OwnAwareInspectorBody listingId={LISTING_ID} onTitleChange={onTitleChange}>
      <div data-testid="showcase-body" />
    </OwnAwareInspectorBody>,
    { wrapper: Wrapper },
  );
};

const createOwnResponse = (name: string): ReturnType<typeof create<typeof GetOwnListingResponseSchema>> => create(
  GetOwnListingResponseSchema,
  {
    listing: create(OwnListingSchema, {
      listing: create(ListingSchema, { id: LISTING_ID }),
      product: create(ProductSchema, { name }),
    }),
  },
);

describe('OwnAwareInspectorBody', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the card of the supplier and reports the product name when the listing belongs to the company', async () => {
    const onTitleChange = vi.fn();

    renderBody(() => createOwnResponse('Яблоки Голден'), onTitleChange);

    await waitFor(() => {
      expect(screen.getByTestId('own-details').textContent).toBe('Яблоки Голден');
    });

    expect(screen.queryByTestId('showcase-body')).toBeNull();
    expect(onTitleChange).toHaveBeenLastCalledWith('Яблоки Голден');
  });

  it('falls back to the showcase body when the listing is not found among the own ones', async () => {
    renderBody(() => {
      throw createApiError(ErrorCode.NOT_FOUND);
    });

    await waitFor(() => {
      expect(screen.getByTestId('showcase-body')).toBeTruthy();
    });

    expect(screen.queryByTestId('own-details')).toBeNull();
  });

  it('shows the error with a retry instead of the showcase body when the own listing fails for another reason', async () => {
    renderBody(() => {
      throw createApiError(ErrorCode.PERMISSION_DENIED);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    expect(screen.queryByTestId('showcase-body')).toBeNull();
    expect(screen.queryByTestId('own-details')).toBeNull();
  });
});
