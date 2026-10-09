import type { ListWarehousesResponse } from '@skladburg/contracts/organization/v1/organization';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  ListWarehousesResponseSchema,
  OrganizationService,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IDemoControl } from '@/shared/api';
import type { TestRuntimeOptionsValue } from '@/shared/api/index.testing';
import type { ILocalizer } from '@/shared/i18n';

import {
  ApiRuntimeProvider,
  createQueryClient,
  useApiClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { LiveRegionProvider } from '@/shared/ui';

import { ResetDemoConfirm } from './ResetDemoConfirm';

interface DeferredValue {
  promise: Promise<void>;
  resolve: () => void;
}

const PROMPT = defaultLocaleCatalog['demo.reset.confirm.prompt'];
const ACCEPT_LABEL = defaultLocaleCatalog['demo.reset.confirm.accept'];
const CANCEL_LABEL = defaultLocaleCatalog['demo.reset.confirm.cancel'];
const PENDING_LABEL = defaultLocaleCatalog['demo.reset.pending'];
const DONE_MESSAGE = defaultLocaleCatalog['demo.reset.done'];

const FIRST_WAREHOUSE = { address: 'г. Северск, ул. Складская, 1', id: 'f5000001-0000-4000-8000-000000000000', name: 'Склад «Север»' };
const SECOND_WAREHOUSE = { address: 'г. Северск, ул. Заводская, 7', id: 'f5000002-0000-4000-8000-000000000000', name: 'Склад «Юг»' };

const createDeferred = (): DeferredValue => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const createDemoControl = (reset: IDemoControl['reset']): IDemoControl => ({
  listPersonas: () => Promise.resolve([]),
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset,
});

const createCodedError = (): ConnectError => new ConnectError(
  'conflict',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.INVALID_TRANSITION }) }],
);

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const createWarehousesResponse = (): ListWarehousesResponse => create(ListWarehousesResponseSchema, {
  warehouses: [FIRST_WAREHOUSE, SECOND_WAREHOUSE].map(warehouse => create(WarehouseSchema, warehouse)),
});

const WarehouseNamesProbe = (): ReactElement => {
  const client = useApiClient();
  const { data = [] } = useQuery({
    queryFn: async (): Promise<readonly string[]> => {
      const response = await client.organization.listWarehouses({});

      return response.warehouses.map(warehouse => warehouse.name);
    },
    queryKey: ['probe', 'warehouse-names'],
  });

  return (
    <ul>
      {data.map(name => <li key={name}>{name}</li>)}
    </ul>
  );
};

const renderWithProviders = async (
  demoControl: IDemoControl | undefined,
  content: ReactElement,
  routes?: TestRuntimeOptionsValue['routes'],
): Promise<void> => {
  const localizer = await createTestLocalizer();
  const queryClient = createQueryClient({ networkMode: 'always' });
  const runtime = createTestRuntime({ demoControl, routes });

  render(
    <LocalizerProvider localizer={localizer}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <LiveRegionProvider>{content}</LiveRegionProvider>
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LocalizerProvider>,
  );
};

const getConfirmGroup = (): HTMLElement => screen.getByRole('group', { name: PROMPT });

const getAnnouncement = (): string => screen.getByRole('status').textContent;

const getAcceptButton = (): HTMLElement => within(getConfirmGroup()).getByRole('button', { name: ACCEPT_LABEL });

describe('ResetDemoConfirm', () => {
  afterEach(() => {
    cleanup();
  });

  it('asks the owner to close on cancel and on Escape', async () => {
    const onClose = vi.fn();
    await renderWithProviders(createDemoControl(() => Promise.resolve()), <ResetDemoConfirm onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: CANCEL_LABEL }));

    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('button', { name: CANCEL_LABEL }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('focuses the cancel button and announces the question', async () => {
    await renderWithProviders(createDemoControl(() => Promise.resolve()), <ResetDemoConfirm onClose={vi.fn()} />);

    const group = getConfirmGroup();

    expect(within(group).getByText(defaultLocaleCatalog['demo.reset.confirm.hint'])).toBeDefined();
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual([CANCEL_LABEL, ACCEPT_LABEL]);
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: CANCEL_LABEL }));
    expect(getAnnouncement()).toBe(PROMPT);
  });

  it('lays the group out in a row by default and in a column when stacked', async () => {
    await renderWithProviders(createDemoControl(() => Promise.resolve()), <ResetDemoConfirm onClose={vi.fn()} />);

    expect(getConfirmGroup().className).toContain('flex-wrap');

    cleanup();
    await renderWithProviders(createDemoControl(() => Promise.resolve()), <ResetDemoConfirm isStacked onClose={vi.fn()} />);

    expect(getConfirmGroup().className).toContain('flex-col');
    expect(getConfirmGroup().className).not.toContain('flex-wrap');
  });

  it('ignores other keys', async () => {
    const onClose = vi.fn();
    await renderWithProviders(createDemoControl(() => Promise.resolve()), <ResetDemoConfirm onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('button', { name: CANCEL_LABEL }), { key: 'a' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('resets once, shows the progress, then closes once and announces the result', async () => {
    const response = createDeferred();
    const onClose = vi.fn();
    const reset = vi.fn(() => response.promise);
    await renderWithProviders(createDemoControl(reset), <ResetDemoConfirm onClose={onClose} />);

    fireEvent.click(getAcceptButton());

    const pendingButton = await within(getConfirmGroup()).findByRole('button', { name: PENDING_LABEL });

    expect(pendingButton.getAttribute('aria-busy')).toBe('true');
    expect(pendingButton.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(pendingButton);

    expect(reset).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    response.resolve();

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(getAnnouncement()).toBe(DONE_MESSAGE);
  });

  it('does not close while the reset runs, neither by cancel nor by Escape', async () => {
    const response = createDeferred();
    const onClose = vi.fn();
    await renderWithProviders(createDemoControl(() => response.promise), <ResetDemoConfirm onClose={onClose} />);

    const group = getConfirmGroup();
    const cancelButton = within(group).getByRole('button', { name: CANCEL_LABEL });
    fireEvent.click(getAcceptButton());
    const pendingButton = await within(group).findByRole('button', { name: PENDING_LABEL });

    expect(cancelButton.hasAttribute('disabled')).toBe(true);
    expect(document.activeElement).toBe(pendingButton);

    fireEvent.click(cancelButton);
    fireEvent.keyDown(pendingButton, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(getConfirmGroup()).toBe(group);

    response.resolve();

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the error by code under the group, keeps the group and the focus, and allows trying again', async () => {
    let isFailing = true;
    const onClose = vi.fn();
    const reset = vi.fn(() => (isFailing ? Promise.reject(createCodedError()) : Promise.resolve()));
    await renderWithProviders(createDemoControl(reset), <ResetDemoConfirm onClose={onClose} />);

    const group = getConfirmGroup();
    fireEvent.click(getAcceptButton());

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe(defaultLocaleCatalog['error.invalid_transition']);
    expect(getConfirmGroup()).toBe(group);
    expect(group.contains(alert)).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getAcceptButton());
    expect(getAcceptButton().getAttribute('aria-busy')).toBeNull();

    isFailing = false;
    fireEvent.click(getAcceptButton());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('does not change the data before the answer and does not refetch by itself', async () => {
    const response = createDeferred();
    const onClose = vi.fn();
    const listWarehouses = vi.fn(createWarehousesResponse);
    await renderWithProviders(
      createDemoControl(() => response.promise),
      <>
        <WarehouseNamesProbe />
        <ResetDemoConfirm onClose={onClose} />
      </>,
      router => router.service(OrganizationService, { listWarehouses }),
    );

    await screen.findByText(FIRST_WAREHOUSE.name);
    fireEvent.click(getAcceptButton());
    await within(getConfirmGroup()).findByRole('button', { name: PENDING_LABEL });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(SECOND_WAREHOUSE.name)).toBeDefined();

    response.resolve();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    expect(listWarehouses).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
