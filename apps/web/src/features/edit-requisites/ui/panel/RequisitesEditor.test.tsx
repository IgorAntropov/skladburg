import type {
  OrganizationRequisites,
  UpdateOrganizationRequisitesRequest,
  UpdateOrganizationRequisitesResponse,
} from '@skladburg/contracts/organization/v1/requisites';
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
  BankAccountSchema,
  GetOrganizationRequisitesResponseSchema,
  OrganizationRequisitesSchema,
  OrganizationRequisitesService,
  UpdateOrganizationRequisitesResponseSchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
import { QueryClientProvider } from '@tanstack/react-query';
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
  beforeEach,
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
import { useCatalogSection } from '@/shared/i18n';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { LiveRegionProvider } from '@/shared/ui';

import { requisitesSection } from '../../i18n/requisitesSection';
import { RequisitesEditor } from './RequisitesEditor';

vi.mock('@/entities/session', () => ({
  useCommandAccess: () => ({ status: 'allowed' }),
}));

vi.mock('@/entities/organization', () => ({
  useActingOrganizationQuery: () => ({
    data: { inn: '', kpp: '', legalName: 'ООО «Вымышленная»', ogrn: '' },
    error: null,
    isFetching: false,
    refetch: () => Promise.resolve(),
  }),
}));

const ADDRESS_LABEL = 'Юридический адрес';
const SUBMIT_LABEL = 'Сохранить';
const RELOAD_LABEL = 'Показать актуальные';

const createRequisites = (version: bigint, legalAddress: string): OrganizationRequisites => create(OrganizationRequisitesSchema, {
  bank: create(BankAccountSchema, {
    bankName: 'Банк «Север»',
    bik: '040000501',
    correspondentAccount: '30101810600000000501',
    settlementAccount: '40702810300000000001',
  }),
  legalAddress,
  timeZone: 'Europe/Moscow',
  vatMode: VatMode.GENERAL,
  version,
});

const createVersionConflict = (): ConnectError => new ConnectError(
  'conflict',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.VERSION_CONFLICT }) }],
);

interface ServerValue {
  requisites: OrganizationRequisites;
  update: ReturnType<typeof vi.fn<(request: UpdateOrganizationRequisitesRequest) => UpdateOrganizationRequisitesResponse>>;
}

const createServer = (initial: OrganizationRequisites): ServerValue => {
  const server: ServerValue = {
    requisites: initial,
    update: vi.fn((request: UpdateOrganizationRequisitesRequest): UpdateOrganizationRequisitesResponse => {
      if (request.expectedVersion !== server.requisites.version) {
        throw createVersionConflict();
      }

      server.requisites = create(OrganizationRequisitesSchema, {
        ...server.requisites,
        bank: request.bank,
        legalAddress: request.legalAddress,
        vatMode: request.vatMode,
        version: server.requisites.version + 1n,
      });

      return create(UpdateOrganizationRequisitesResponseSchema, { requisites: server.requisites });
    }),
  };

  return server;
};

const Editor = ({ initial }: { initial: OrganizationRequisites }): null | ReactElement => {
  const { t } = useCatalogSection(requisitesSection);

  return t === undefined ? null : <RequisitesEditor requisites={initial} t={t} />;
};

const renderEditor = (server: ServerValue): void => {
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(OrganizationRequisitesService, {
        getOrganizationRequisites: () => create(GetOrganizationRequisitesResponseSchema, { requisites: server.requisites }),
        updateOrganizationRequisites: server.update,
      });
    },
  });

  render(withTestLocalizer(
    <LiveRegionProvider>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
          <Editor initial={server.requisites} />
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LiveRegionProvider>,
  ));
};

const getAddressInput = async (): Promise<HTMLInputElement> => {
  const element = await screen.findByLabelText(ADDRESS_LABEL);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError('The address is not an input');
  }

  return element;
};

const pressSubmit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));
};

describe('RequisitesEditor', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('sends the version it was opened with and the next version after a save', async () => {
    const server = createServer(createRequisites(1n, 'г. Вымышленск, ул. Первая, д. 1'));
    renderEditor(server);
    const address = await getAddressInput();

    fireEvent.change(address, { target: { value: 'г. Вымышленск, ул. Вторая, д. 2' } });
    pressSubmit();
    await waitFor(() => {
      expect(server.update).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: SUBMIT_LABEL }).getAttribute('aria-busy')).toBeNull();
    });
    fireEvent.change(address, { target: { value: 'г. Вымышленск, ул. Третья, д. 3' } });
    pressSubmit();

    await waitFor(() => {
      expect(server.update).toHaveBeenCalledTimes(2);
    });
    expect(server.update.mock.calls.map(([request]) => request.expectedVersion)).toEqual([1n, 2n]);
    expect(server.requisites.version).toBe(3n);
  });

  it('keeps the typed address and offers the actual data when the version is out of date', async () => {
    const server = createServer(createRequisites(1n, 'г. Вымышленск, ул. Первая, д. 1'));
    renderEditor(server);
    const address = await getAddressInput();
    server.requisites = createRequisites(5n, 'г. Вымышленск, ул. Чужая, д. 9');

    fireEvent.change(address, { target: { value: 'г. Вымышленск, ул. Моя, д. 2' } });
    pressSubmit();

    expect(await screen.findByRole('button', { name: RELOAD_LABEL })).toBeTruthy();
    expect(address.value).toBe('г. Вымышленск, ул. Моя, д. 2');
  });

  it('replaces the form with the actual data and saves with the actual version after the reload', async () => {
    const server = createServer(createRequisites(1n, 'г. Вымышленск, ул. Первая, д. 1'));
    renderEditor(server);
    const address = await getAddressInput();
    server.requisites = createRequisites(5n, 'г. Вымышленск, ул. Чужая, д. 9');
    fireEvent.change(address, { target: { value: 'г. Вымышленск, ул. Моя, д. 2' } });
    pressSubmit();
    const reload = await screen.findByRole('button', { name: RELOAD_LABEL });

    act(() => {
      reload.click();
    });

    await waitFor(async () => {
      expect((await getAddressInput()).value).toBe('г. Вымышленск, ул. Чужая, д. 9');
    });
    expect(screen.queryByRole('button', { name: RELOAD_LABEL })).toBeNull();

    pressSubmit();

    await waitFor(() => {
      expect(server.update).toHaveBeenCalledTimes(2);
    });
    expect(server.update.mock.calls[1]?.[0].expectedVersion).toBe(5n);
  });
});
