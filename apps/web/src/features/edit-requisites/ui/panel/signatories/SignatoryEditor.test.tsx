import type {
  OrganizationRequisites,
  RemoveSignatoryRequest,
  RemoveSignatoryResponse,
  SaveSignatoryRequest,
  SaveSignatoryResponse,
  UpdateOrganizationRequisitesRequest,
  UpdateOrganizationRequisitesResponse,
} from '@skladburg/contracts/organization/v1/requisites';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import {
  ErrorCode,
  ErrorDetailSchema,
  FieldViolationSchema,
  ValidationFailedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  BankAccountSchema,
  GetOrganizationRequisitesResponseSchema,
  OrganizationRequisitesSchema,
  OrganizationRequisitesService,
  RemoveSignatoryResponseSchema,
  SaveSignatoryResponseSchema,
  SignatoryBasis,
  SignatorySchema,
  UpdateOrganizationRequisitesResponseSchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
  getOrganizationScope,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import { useCatalogSection } from '@/shared/i18n';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { LiveRegionProvider } from '@/shared/ui';

import { requisitesKeys } from '../../../api/requisitesKeys';
import { requisitesSection } from '../../../i18n/requisitesSection';
import { RequisitesEditor } from '../RequisitesEditor';

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

const CHARTER_ID = '0b9c1f3e-6d4a-4e55-8f1d-7a2b3c4d5e6f';
const ATTORNEY_ID = '1c0d2a4f-7e5b-4f66-9a2e-8b3c4d5e6f70';

const ADD_LABEL = 'Добавить подписанта';
const ADDRESS_LABEL = 'Юридический адрес';
const BASIS_LABEL = 'Основание полномочий';
const DATE_LABEL = 'Дата доверенности';
const FULL_NAME_LABEL = 'ФИО';
const NUMBER_LABEL = 'Номер доверенности';
const POSITION_LABEL = 'Должность';
const RELOAD_LABEL = 'Показать актуальные';

const NEW_FULL_NAME = 'Образцов Образец Образцович';
const NEW_POSITION = 'Главный бухгалтер';

const ignoreUnsavedChange = (): void => undefined;

const createRequisites = (): OrganizationRequisites => create(OrganizationRequisitesSchema, {
  bank: create(BankAccountSchema, {
    bankName: 'Банк «Север»',
    bik: '040000501',
    correspondentAccount: '30101810600000000501',
    settlementAccount: '40702810300000000001',
  }),
  legalAddress: 'г. Вымышленск, ул. Первая, д. 1',
  signatories: [
    create(SignatorySchema, {
      basis: SignatoryBasis.CHARTER,
      fullName: 'Тестов Тест Тестович',
      id: CHARTER_ID,
      isDefault: true,
      position: 'Директор',
    }),
    create(SignatorySchema, {
      basis: SignatoryBasis.POWER_OF_ATTORNEY,
      fullName: 'Пример Пример Примерович',
      id: ATTORNEY_ID,
      position: 'Заместитель директора',
      powerOfAttorneyDate: create(CalendarDateSchema, { day: 12, month: 1, year: 2026 }),
      powerOfAttorneyNumber: '7',
    }),
  ],
  timeZone: 'Europe/Moscow',
  vatMode: VatMode.GENERAL,
  version: 1n,
});

const createVersionConflict = (): ConnectError => new ConnectError(
  'conflict',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.VERSION_CONFLICT }) }],
);

const createValidationError = (violations: [string, string][]): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{
    desc: ErrorDetailSchema,
    value: create(ErrorDetailSchema, {
      code: ErrorCode.VALIDATION_FAILED,
      params: {
        case: 'validationFailed',
        value: create(ValidationFailedParamsSchema, {
          violations: violations.map(([fieldPath, ruleId]) => create(FieldViolationSchema, { fieldPath, ruleId })),
        }),
      },
    }),
  }],
);

interface ServerValue {
  failure: ConnectError | undefined;
  remove: ReturnType<typeof vi.fn<(request: RemoveSignatoryRequest) => RemoveSignatoryResponse>>;
  requisites: OrganizationRequisites;
  save: ReturnType<typeof vi.fn<(request: SaveSignatoryRequest) => SaveSignatoryResponse>>;
  update: ReturnType<typeof vi.fn<(request: UpdateOrganizationRequisitesRequest) => UpdateOrganizationRequisitesResponse>>;
}

const createServer = (): ServerValue => {
  const server: ServerValue = {
    failure: undefined,
    remove: vi.fn((request: RemoveSignatoryRequest): RemoveSignatoryResponse => {
      if (request.expectedVersion !== server.requisites.version) {
        throw createVersionConflict();
      }

      server.requisites = create(OrganizationRequisitesSchema, {
        ...server.requisites,
        signatories: server.requisites.signatories.filter(signatory => signatory.id !== request.signatoryId),
        version: server.requisites.version + 1n,
      });

      return create(RemoveSignatoryResponseSchema, { requisites: server.requisites });
    }),
    requisites: createRequisites(),
    save: vi.fn((request: SaveSignatoryRequest): SaveSignatoryResponse => {
      if (server.failure !== undefined) {
        throw server.failure;
      }

      if (request.expectedVersion !== server.requisites.version) {
        throw createVersionConflict();
      }

      const { signatory } = request;

      if (signatory === undefined) {
        throw new TypeError('The request has no signatory');
      }

      const isKnown = server.requisites.signatories.some(item => item.id === signatory.id);
      const replaced = server.requisites.signatories.map(item => (item.id === signatory.id ? signatory : item));

      server.requisites = create(OrganizationRequisitesSchema, {
        ...server.requisites,
        signatories: isKnown ? replaced : [...replaced, signatory],
        version: server.requisites.version + 1n,
      });

      return create(SaveSignatoryResponseSchema, { requisites: server.requisites });
    }),
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

  return t === undefined ? null : <RequisitesEditor onUnsavedChange={ignoreUnsavedChange} requisites={initial} t={t} />;
};

const renderEditor = (server: ServerValue): QueryClient => {
  const queryClient = createQueryClient({ networkMode: 'always' });
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(OrganizationRequisitesService, {
        getOrganizationRequisites: () => create(GetOrganizationRequisitesResponseSchema, { requisites: server.requisites }),
        removeSignatory: server.remove,
        saveSignatory: server.save,
        updateOrganizationRequisites: server.update,
      });
    },
  });

  render(withTestLocalizer(
    <LiveRegionProvider>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <Editor initial={server.requisites} />
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LiveRegionProvider>,
  ));

  return queryClient;
};

const findInput = async (label: string): Promise<HTMLInputElement> => {
  const element = await screen.findByLabelText(label);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`The field "${label}" is not an input`);
  }

  return element;
};

const findSelect = async (label: string): Promise<HTMLSelectElement> => {
  const element = await screen.findByLabelText(label);

  if (!(element instanceof HTMLSelectElement)) {
    throw new TypeError(`The field "${label}" is not a select`);
  }

  return element;
};

const typeInto = (element: HTMLInputElement, value: string): void => {
  fireEvent.change(element, { target: { value } });
};

const openNewEditor = async (): Promise<void> => {
  fireEvent.click(await screen.findByRole('button', { name: ADD_LABEL }));
  await screen.findByTestId('signatory-editor');
};

const fillNameAndPosition = async (): Promise<void> => {
  typeInto(await findInput(FULL_NAME_LABEL), NEW_FULL_NAME);
  typeInto(await findInput(POSITION_LABEL), NEW_POSITION);
};

const chooseBasis = async (basis: SignatoryBasis): Promise<void> => {
  fireEvent.change(await findSelect(BASIS_LABEL), { target: { value: String(basis) } });
};

const pressSave = (): void => {
  fireEvent.click(screen.getByTestId('signatory-save'));
};

const lastSavedSignatory = (server: ServerValue): NonNullable<SaveSignatoryRequest['signatory']> => {
  const signatory = server.save.mock.calls.at(-1)?.[0].signatory;

  if (signatory === undefined) {
    throw new TypeError('No signatory was sent');
  }

  return signatory;
};

describe('SignatoryEditor', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the number and the date of the power of attorney only for that basis', async () => {
    renderEditor(createServer());
    await openNewEditor();

    expect(screen.queryByLabelText(NUMBER_LABEL)).toBeNull();
    expect(screen.queryByLabelText(DATE_LABEL)).toBeNull();

    await chooseBasis(SignatoryBasis.POWER_OF_ATTORNEY);

    expect(await findInput(NUMBER_LABEL)).toBeTruthy();
    expect((await findInput(DATE_LABEL)).type).toBe('date');

    await chooseBasis(SignatoryBasis.CHARTER);

    expect(screen.queryByLabelText(NUMBER_LABEL)).toBeNull();
    expect(screen.queryByLabelText(DATE_LABEL)).toBeNull();
  });

  it('does not send the power of attorney typed before the basis was changed back to the charter', async () => {
    const server = createServer();
    renderEditor(server);
    await openNewEditor();
    await fillNameAndPosition();
    await chooseBasis(SignatoryBasis.POWER_OF_ATTORNEY);
    typeInto(await findInput(NUMBER_LABEL), '15');
    typeInto(await findInput(DATE_LABEL), '2026-02-03');
    await chooseBasis(SignatoryBasis.CHARTER);

    pressSave();

    await waitFor(() => {
      expect(server.save).toHaveBeenCalledTimes(1);
    });
    const sent = lastSavedSignatory(server);

    expect(sent.basis).toBe(SignatoryBasis.CHARTER);
    expect(sent.powerOfAttorneyNumber).toBe('');
    expect(sent.powerOfAttorneyDate).toBeUndefined();
  });

  it('saves under the charter after a too long number of the power of attorney was typed and the basis was changed back', async () => {
    const server = createServer();
    renderEditor(server);
    await openNewEditor();
    await fillNameAndPosition();
    await chooseBasis(SignatoryBasis.POWER_OF_ATTORNEY);
    typeInto(await findInput(NUMBER_LABEL), '9'.repeat(41));
    typeInto(await findInput(DATE_LABEL), '2026-02-03');
    await chooseBasis(SignatoryBasis.CHARTER);

    pressSave();

    await waitFor(() => {
      expect(server.save).toHaveBeenCalledTimes(1);
    });
    const sent = lastSavedSignatory(server);

    expect(sent.basis).toBe(SignatoryBasis.CHARTER);
    expect(sent.powerOfAttorneyNumber).toBe('');
    expect(sent.powerOfAttorneyDate).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends the date of the field as a calendar date and the trimmed texts', async () => {
    const server = createServer();
    renderEditor(server);
    await openNewEditor();
    typeInto(await findInput(FULL_NAME_LABEL), `  ${NEW_FULL_NAME}  `);
    typeInto(await findInput(POSITION_LABEL), NEW_POSITION);
    await chooseBasis(SignatoryBasis.POWER_OF_ATTORNEY);
    typeInto(await findInput(NUMBER_LABEL), ' 15 ');
    typeInto(await findInput(DATE_LABEL), '2026-02-03');

    pressSave();

    await waitFor(() => {
      expect(server.save).toHaveBeenCalledTimes(1);
    });
    const sent = lastSavedSignatory(server);

    expect(sent.fullName).toBe(NEW_FULL_NAME);
    expect(sent.powerOfAttorneyNumber).toBe('15');
    expect(sent.powerOfAttorneyDate).toMatchObject({ day: 3, month: 2, year: 2026 });
    expect(sent.isDefault).toBe(false);
    expect(server.save.mock.calls[0]?.[0].expectedVersion).toBe(1n);
  });

  it('sends an empty date as not set and shows the answer of the server under the date', async () => {
    const server = createServer();
    server.failure = createValidationError([['signatory.power_of_attorney_date', 'signatory.power_of_attorney_date_required']]);
    renderEditor(server);
    await openNewEditor();
    await fillNameAndPosition();
    await chooseBasis(SignatoryBasis.POWER_OF_ATTORNEY);
    typeInto(await findInput(NUMBER_LABEL), '15');

    pressSave();

    expect(await screen.findByText('Укажите дату доверенности')).toBeTruthy();
    expect(lastSavedSignatory(server).powerOfAttorneyDate).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the answer of the server about the number under the number', async () => {
    const server = createServer();
    server.failure = createValidationError([['signatory.power_of_attorney_number', 'signatory.power_of_attorney_number_required']]);
    renderEditor(server);
    await openNewEditor();
    await fillNameAndPosition();
    await chooseBasis(SignatoryBasis.POWER_OF_ATTORNEY);
    typeInto(await findInput(DATE_LABEL), '2026-02-03');

    pressSave();

    expect(await screen.findByText('Укажите номер доверенности')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a violation of a part of the date under the date field', async () => {
    const server = createServer();
    server.failure = createValidationError([['signatory.power_of_attorney_date.year', 'int32.gte_lte']]);
    renderEditor(server);
    await openNewEditor();
    await fillNameAndPosition();
    await chooseBasis(SignatoryBasis.POWER_OF_ATTORNEY);
    typeInto(await findInput(NUMBER_LABEL), '15');
    typeInto(await findInput(DATE_LABEL), '20260-02-03');

    pressSave();

    expect(await screen.findByText('Дата вне допустимого диапазона')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(lastSavedSignatory(server).powerOfAttorneyDate).toMatchObject({ year: 20_260 });
  });

  it('shows a violation without a field of the form as a general text and keeps the editor open', async () => {
    const server = createServer();
    server.failure = createValidationError([['signatory', 'signatory.count_max']]);
    renderEditor(server);
    await openNewEditor();
    await fillNameAndPosition();

    pressSave();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('signatory-editor')).toBeTruthy();
  });

  it('closes the editor after a save and shows the list that the server answered and keeps it in the cache', async () => {
    const server = createServer();
    const queryClient = renderEditor(server);
    await openNewEditor();
    await fillNameAndPosition();

    pressSave();

    await waitFor(() => {
      expect(screen.queryByTestId('signatory-editor')).toBeNull();
    });
    const added = server.requisites.signatories.at(-1);

    expect(added?.fullName).toBe(NEW_FULL_NAME);
    expect(screen.getByTestId(`requisites-signatory-${added?.id ?? ''}`).textContent).toContain(NEW_FULL_NAME);
    expect(queryClient.getQueryData(requisitesKeys.detail(getOrganizationScope(TEST_ORGANIZATION_ID)))).toEqual(server.requisites);
  });

  it('opens an existing signatory with its values and saves it under the same id', async () => {
    const server = createServer();
    renderEditor(server);
    fireEvent.click(await screen.findByTestId(`requisites-signatory-edit-${ATTORNEY_ID}`));

    const editor = await screen.findByTestId('signatory-editor');

    expect((await findInput(FULL_NAME_LABEL)).value).toBe('Пример Пример Примерович');
    expect((await findInput(NUMBER_LABEL)).value).toBe('7');
    expect((await findInput(DATE_LABEL)).value).toBe('2026-01-12');
    expect(within(editor).getByRole('heading').textContent).toBe('Правка подписанта');

    typeInto(await findInput(POSITION_LABEL), NEW_POSITION);
    pressSave();

    await waitFor(() => {
      expect(server.save).toHaveBeenCalledTimes(1);
    });
    const sent = lastSavedSignatory(server);

    expect(sent.id).toBe(ATTORNEY_ID);
    expect(sent.isDefault).toBe(false);
    expect(sent.powerOfAttorneyDate).toMatchObject({ day: 12, month: 1, year: 2026 });
  });

  it('turns off the other actions while the editor is open', async () => {
    renderEditor(createServer());
    await openNewEditor();

    expect(screen.getByRole('button', { name: ADD_LABEL }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId(`requisites-signatory-edit-${CHARTER_ID}`).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId(`requisites-signatory-default-${ATTORNEY_ID}`).getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(screen.getByTestId('signatory-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('signatory-editor')).toBeNull();
    });
    expect(screen.getByRole('button', { name: ADD_LABEL }).getAttribute('aria-disabled')).toBeNull();
  });
});

describe('Signatories and the form of the requisites', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('saves the typed address with the new version after a signatory was saved', async () => {
    const server = createServer();
    renderEditor(server);
    const address = await findInput(ADDRESS_LABEL);
    typeInto(address, 'г. Вымышленск, ул. Вторая, д. 2');
    await openNewEditor();
    await fillNameAndPosition();
    pressSave();
    await waitFor(() => {
      expect(screen.queryByTestId('signatory-editor')).toBeNull();
    });

    fireEvent.click(screen.getByTestId('requisites-submit'));

    await waitFor(() => {
      expect(server.update).toHaveBeenCalledTimes(1);
    });
    expect(server.update.mock.calls[0]?.[0].expectedVersion).toBe(2n);
    expect(screen.queryByRole('button', { name: RELOAD_LABEL })).toBeNull();
    expect(address.value).toBe('г. Вымышленск, ул. Вторая, д. 2');
  });

  it('removes a signatory only after the confirmation and with the current version', async () => {
    const server = createServer();
    renderEditor(server);
    fireEvent.click(await screen.findByTestId(`requisites-signatory-remove-${ATTORNEY_ID}`));

    expect(server.remove).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByTestId(`requisites-signatory-remove-confirm-${ATTORNEY_ID}`));

    await waitFor(() => {
      expect(screen.queryByTestId(`requisites-signatory-${ATTORNEY_ID}`)).toBeNull();
    });
    expect(server.remove.mock.calls[0]?.[0]).toMatchObject({ expectedVersion: 1n, signatoryId: ATTORNEY_ID });
    expect(screen.getByTestId(`requisites-signatory-${CHARTER_ID}`)).toBeTruthy();
  });

  it('makes a signatory the default one by sending it again with the flag', async () => {
    const server = createServer();
    renderEditor(server);

    fireEvent.click(await screen.findByTestId(`requisites-signatory-default-${ATTORNEY_ID}`));

    await waitFor(() => {
      expect(server.save).toHaveBeenCalledTimes(1);
    });
    const sent = lastSavedSignatory(server);

    expect(sent.id).toBe(ATTORNEY_ID);
    expect(sent.isDefault).toBe(true);
    expect(sent.powerOfAttorneyNumber).toBe('7');
  });

  it('offers the actual data when the version of a signatory is out of date', async () => {
    const server = createServer();
    renderEditor(server);
    await openNewEditor();
    await fillNameAndPosition();
    server.requisites = create(OrganizationRequisitesSchema, { ...server.requisites, version: 6n });

    pressSave();

    const reload = await screen.findByTestId('signatory-reload');

    expect((await findInput(FULL_NAME_LABEL)).value).toBe(NEW_FULL_NAME);

    fireEvent.click(reload);

    await waitFor(() => {
      expect(screen.queryByTestId('signatory-editor')).toBeNull();
    });
    fireEvent.click(await screen.findByTestId(`requisites-signatory-default-${ATTORNEY_ID}`));

    await waitFor(() => {
      expect(server.save).toHaveBeenCalledTimes(2);
    });
    expect(server.save.mock.calls[1]?.[0].expectedVersion).toBe(6n);
  });
});
