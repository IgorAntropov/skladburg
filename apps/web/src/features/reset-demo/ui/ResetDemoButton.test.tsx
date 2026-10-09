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

import { ResetDemoButton } from './ResetDemoButton';
import { ResetDemoConfirm } from './ResetDemoConfirm';

interface DeferredValue {
  promise: Promise<void>;
  resolve: () => void;
}

const RESET_LABEL = defaultLocaleCatalog['demo.reset.label'];
const PROMPT = defaultLocaleCatalog['demo.reset.confirm.prompt'];
const ACCEPT_LABEL = defaultLocaleCatalog['demo.reset.confirm.accept'];
const CANCEL_LABEL = defaultLocaleCatalog['demo.reset.confirm.cancel'];
const PENDING_LABEL = defaultLocaleCatalog['demo.reset.pending'];
const DONE_MESSAGE = defaultLocaleCatalog['demo.reset.done'];

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

const FIRST_WAREHOUSE = { address: 'г. Северск, ул. Складская, 1', id: 'f5000001-0000-4000-8000-000000000000', name: 'Склад «Север»' };
const SECOND_WAREHOUSE = { address: 'г. Северск, ул. Заводская, 7', id: 'f5000002-0000-4000-8000-000000000000', name: 'Склад «Юг»' };

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

const getResetButton = (): HTMLElement => screen.getByRole('button', { name: RESET_LABEL });

const getConfirmGroup = (): HTMLElement => screen.getByRole('group', { name: PROMPT });

const getAnnouncement = (): string => screen.getByRole('status').textContent;

const openConfirm = (): HTMLElement => {
  fireEvent.click(getResetButton());

  return getConfirmGroup();
};

describe('ResetDemoButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing without the demo control', async () => {
    await renderWithProviders(undefined, <ResetDemoButton />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('shows the plain button first and does not call reset on the first click', async () => {
    const reset = vi.fn(() => Promise.resolve());
    await renderWithProviders(createDemoControl(reset), <ResetDemoButton />);

    expect(screen.queryByRole('group')).toBeNull();

    openConfirm();

    expect(reset).not.toHaveBeenCalled();
  });

  it('keeps the button mounted and expanded, opens a labelled group, focuses the cancel button and announces the question', async () => {
    await renderWithProviders(createDemoControl(() => Promise.resolve()), <ResetDemoButton />);

    const resetButton = getResetButton();

    expect(resetButton.getAttribute('aria-expanded')).toBe('false');
    expect(resetButton.hasAttribute('aria-controls')).toBe(false);

    const group = openConfirm();

    expect(getResetButton()).toBe(resetButton);
    expect(resetButton.getAttribute('aria-expanded')).toBe('true');
    expect(resetButton.getAttribute('aria-controls')).toBe(group.parentElement?.parentElement?.id);
    expect(resetButton.getAttribute('aria-controls')).not.toBe('');
    expect(within(group).getByText(defaultLocaleCatalog['demo.reset.confirm.hint'])).toBeDefined();
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual([CANCEL_LABEL, ACCEPT_LABEL]);
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: CANCEL_LABEL }));
    expect(getAnnouncement()).toBe(PROMPT);
  });

  it('closes the group by the second click on the button without calling reset', async () => {
    const reset = vi.fn(() => Promise.resolve());
    await renderWithProviders(createDemoControl(reset), <ResetDemoButton />);

    openConfirm();
    fireEvent.click(getResetButton());

    expect(screen.queryByRole('group')).toBeNull();
    expect(getResetButton().getAttribute('aria-expanded')).toBe('false');
    expect(getResetButton().hasAttribute('aria-controls')).toBe(false);
    expect(reset).not.toHaveBeenCalled();
  });

  it('does not close the group by the button while the reset runs', async () => {
    const response = createDeferred();
    await renderWithProviders(createDemoControl(() => response.promise), <ResetDemoButton />);

    const group = openConfirm();
    fireEvent.click(within(group).getByRole('button', { name: ACCEPT_LABEL }));
    await within(group).findByRole('button', { name: PENDING_LABEL });

    fireEvent.click(getResetButton());

    expect(getConfirmGroup()).toBe(group);

    response.resolve();

    await waitFor(() => {
      expect(screen.queryByRole('group')).toBeNull();
    });
    expect(document.activeElement).toBe(getResetButton());
    expect(getAnnouncement()).toBe(DONE_MESSAGE);
  });

  it('goes back to the button with the focus on it on cancel, without calling reset', async () => {
    const reset = vi.fn(() => Promise.resolve());
    await renderWithProviders(createDemoControl(reset), <ResetDemoButton />);

    const group = openConfirm();
    fireEvent.click(within(group).getByRole('button', { name: CANCEL_LABEL }));

    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(getResetButton());
    expect(reset).not.toHaveBeenCalled();
  });

  it('goes back to the button with the focus on it on Escape, without calling reset', async () => {
    const reset = vi.fn(() => Promise.resolve());
    await renderWithProviders(createDemoControl(reset), <ResetDemoButton />);

    openConfirm();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(getResetButton());
    expect(reset).not.toHaveBeenCalled();
  });

  it('can be opened again after a cancel', async () => {
    await renderWithProviders(createDemoControl(() => Promise.resolve()), <ResetDemoButton />);

    fireEvent.click(within(openConfirm()).getByRole('button', { name: CANCEL_LABEL }));
    openConfirm();

    expect(document.activeElement).toBe(within(getConfirmGroup()).getByRole('button', { name: CANCEL_LABEL }));
  });

  it('resets once, shows the progress, and goes back to the button with the done announcement', async () => {
    const response = createDeferred();
    const reset = vi.fn(() => response.promise);
    await renderWithProviders(createDemoControl(reset), <ResetDemoButton />);

    const group = openConfirm();
    fireEvent.click(within(group).getByRole('button', { name: ACCEPT_LABEL }));

    const pendingButton = await within(group).findByRole('button', { name: PENDING_LABEL });

    expect(pendingButton.getAttribute('aria-busy')).toBe('true');
    expect(pendingButton.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(pendingButton);

    expect(reset).toHaveBeenCalledTimes(1);

    response.resolve();

    await waitFor(() => {
      expect(screen.queryByRole('group')).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(getResetButton());
    });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(getAnnouncement()).toBe(DONE_MESSAGE);
  });

  it('does not close while the reset runs, neither by cancel nor by Escape', async () => {
    const response = createDeferred();
    await renderWithProviders(createDemoControl(() => response.promise), <ResetDemoButton />);

    const group = openConfirm();
    const cancelButton = within(group).getByRole('button', { name: CANCEL_LABEL });
    fireEvent.click(within(group).getByRole('button', { name: ACCEPT_LABEL }));
    await within(group).findByRole('button', { name: PENDING_LABEL });

    const pendingButton = within(group).getByRole('button', { name: PENDING_LABEL });

    expect(cancelButton.hasAttribute('disabled')).toBe(true);
    expect(document.activeElement).toBe(pendingButton);

    fireEvent.click(cancelButton);
    fireEvent.keyDown(pendingButton, { key: 'Escape' });

    expect(getConfirmGroup()).toBe(group);

    response.resolve();

    await waitFor(() => {
      expect(screen.queryByRole('group')).toBeNull();
    });
  });

  it('shows the error by code under the group, keeps the group and the focus, and allows trying again', async () => {
    let isFailing = true;
    const reset = vi.fn(() => (isFailing ? Promise.reject(createCodedError()) : Promise.resolve()));
    await renderWithProviders(createDemoControl(reset), <ResetDemoButton />);

    const group = openConfirm();
    fireEvent.click(within(group).getByRole('button', { name: ACCEPT_LABEL }));

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe(defaultLocaleCatalog['error.invalid_transition']);
    expect(getConfirmGroup()).toBe(group);
    expect(group.contains(alert)).toBe(false);
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: ACCEPT_LABEL }));
    expect(within(group).getByRole('button', { name: ACCEPT_LABEL }).getAttribute('aria-busy')).toBeNull();

    isFailing = false;
    fireEvent.click(within(group).getByRole('button', { name: ACCEPT_LABEL }));

    await waitFor(() => {
      expect(screen.queryByRole('group')).toBeNull();
    });
    expect(reset).toHaveBeenCalledTimes(2);
  });
});

describe('ResetDemoButton without optimistic changes', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not change the data before the answer and does not refetch by itself', async () => {
    const response = createDeferred();
    const listWarehouses = vi.fn(createWarehousesResponse);
    await renderWithProviders(
      createDemoControl(() => response.promise),
      <>
        <WarehouseNamesProbe />
        <ResetDemoButton />
      </>,
      router => router.service(OrganizationService, { listWarehouses }),
    );

    await screen.findByText(FIRST_WAREHOUSE.name);
    const group = openConfirm();
    fireEvent.click(within(group).getByRole('button', { name: ACCEPT_LABEL }));
    await within(group).findByRole('button', { name: PENDING_LABEL });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(SECOND_WAREHOUSE.name)).toBeDefined();

    response.resolve();
    await waitFor(() => {
      expect(screen.queryByRole('group')).toBeNull();
    });

    expect(listWarehouses).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

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

  it('closes once and announces the result after the successful reset', async () => {
    const onClose = vi.fn();
    const reset = vi.fn(() => Promise.resolve());
    await renderWithProviders(createDemoControl(reset), <ResetDemoConfirm onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: ACCEPT_LABEL }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(getAnnouncement()).toBe(DONE_MESSAGE);
  });
});
