import type {
  CreateWarehouseRequest,
  CreateWarehouseResponse,
} from '@skladburg/contracts/organization/v1/organization';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
  PermissionDeniedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  CreateWarehouseResponseSchema,
  OrganizationService,
} from '@skladburg/contracts/organization/v1/organization';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { CommandAccessValue } from '@/shared/api';
import type { TestRuntimeOptionsValue } from '@/shared/api/index.testing';

import {
  ApiRuntimeProvider,
  createQueryClient,
  useApiClient,
  useCommand,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { ActionButton } from './ActionButton';

type CreateWarehouseHandler = (request: CreateWarehouseRequest) => CreateWarehouseResponse;

const ADD_LABEL = 'Добавить склад';
const RETRY_LABEL = defaultLocaleCatalog['common.retry'];
const UNAVAILABLE_MESSAGE = defaultLocaleCatalog['error.unavailable'];
const PERMISSION_DENIED_MESSAGE = defaultLocaleCatalog['error.permission_denied'].replace(
  '{permission}',
  defaultLocaleCatalog['permission.warehouse_create'],
);

const ALLOWED_ACCESS: CommandAccessValue = { status: 'allowed' };

const createResponse = (): CreateWarehouseResponse => create(CreateWarehouseResponseSchema, {});

const createDetailError = (code: ErrorCode, permission?: string): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{
    desc: ErrorDetailSchema,
    value: create(ErrorDetailSchema, {
      code,
      params: permission === undefined
        ? { case: undefined }
        : { case: 'permissionDenied', value: create(PermissionDeniedParamsSchema, { permission }) },
    }),
  }],
);

interface AddWarehouseButtonProps {
  access: CommandAccessValue;
}

const AddWarehouseButton = ({ access }: AddWarehouseButtonProps): ReactElement => {
  const client = useApiClient();
  const command = useCommand({
    execute: idempotencyKey => client.organization.createWarehouse({
      boardNodeId: 'node',
      cityId: 'city',
      idempotencyKey,
      name: 'Склад «Север»',
    }),
    method: OrganizationService.method.createWarehouse,
  });

  return <ActionButton access={access} command={command}>{ADD_LABEL}</ActionButton>;
};

const renderButton = (access: CommandAccessValue, createWarehouse: CreateWarehouseHandler): void => {
  const queryClient = createQueryClient({ networkMode: 'always' });
  const routes: TestRuntimeOptionsValue['routes'] = router => router.service(OrganizationService, { createWarehouse });
  const runtime = createTestRuntime({ routes });

  render(withTestLocalizer(
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>
        <AddWarehouseButton access={access} />
      </QueryClientProvider>
    </ApiRuntimeProvider>,
  ));
};

describe('ActionButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('sends one command for a double click', async () => {
    const createWarehouse = vi.fn<CreateWarehouseHandler>(createResponse);
    renderButton(ALLOWED_ACCESS, createWarehouse);

    const button = screen.getByRole('button', { name: ADD_LABEL });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(createWarehouse).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(button.getAttribute('aria-busy')).toBeNull();
    });
    expect(createWarehouse).toHaveBeenCalledTimes(1);
  });

  it('does not send the command while the access is denied', () => {
    const createWarehouse = vi.fn<CreateWarehouseHandler>(createResponse);
    renderButton({ permission: 'warehouse_create', status: 'denied' }, createWarehouse);

    const button = screen.getByRole('button', { name: ADD_LABEL });
    fireEvent.click(button);

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(createWarehouse).not.toHaveBeenCalled();
  });

  it('shows the error by code and retries with the same idempotency key', async () => {
    const createWarehouse = vi.fn<CreateWarehouseHandler>()
      .mockRejectedValueOnce(createDetailError(ErrorCode.UNAVAILABLE))
      .mockResolvedValueOnce(createResponse());
    renderButton(ALLOWED_ACCESS, createWarehouse);

    fireEvent.click(screen.getByRole('button', { name: ADD_LABEL }));

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe(UNAVAILABLE_MESSAGE);

    fireEvent.click(screen.getByRole('button', { name: RETRY_LABEL }));

    await waitFor(() => {
      expect(createWarehouse).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(createWarehouse.mock.calls[1]?.[0].idempotencyKey).toBe(createWarehouse.mock.calls[0]?.[0].idempotencyKey);
    expect(screen.getByRole('button', { name: ADD_LABEL })).toBeDefined();
  });

  it('names the missing permission when the server denies the command', async () => {
    const createWarehouse = vi.fn<CreateWarehouseHandler>()
      .mockRejectedValueOnce(createDetailError(ErrorCode.PERMISSION_DENIED, 'warehouse_create'));
    renderButton(ALLOWED_ACCESS, createWarehouse);

    fireEvent.click(screen.getByRole('button', { name: ADD_LABEL }));

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe(PERMISSION_DENIED_MESSAGE);
    expect(screen.getByRole('button', { name: ADD_LABEL })).toBeDefined();
  });
});
