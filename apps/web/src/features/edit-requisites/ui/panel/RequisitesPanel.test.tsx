import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';

import { create } from '@bufbuild/protobuf';
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
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { LiveRegionProvider } from '@/shared/ui';

import { RequisitesPanel } from './RequisitesPanel';

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
const SOURCE_ADDRESS = 'г. Вымышленск, ул. Первая, д. 1';
const TYPED_ADDRESS = 'г. Вымышленск, ул. Вторая, д. 2';

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

interface RenderedPanelValue {
  location: ReturnType<typeof createMemoryLocation>;
  onClose: ReturnType<typeof vi.fn<() => void>>;
  update: ReturnType<typeof vi.fn<() => void>>;
}

const renderPanel = (): RenderedPanelValue => {
  let requisites = createRequisites(1n, SOURCE_ADDRESS);
  const location = createMemoryLocation('/network');
  const onClose = vi.fn<() => void>();
  const update = vi.fn<() => void>();
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(OrganizationRequisitesService, {
        getOrganizationRequisites: () => create(GetOrganizationRequisitesResponseSchema, { requisites }),
        updateOrganizationRequisites: (request) => {
          update();
          requisites = create(OrganizationRequisitesSchema, {
            ...requisites,
            bank: request.bank,
            legalAddress: request.legalAddress,
            vatMode: request.vatMode,
            version: requisites.version + 1n,
          });

          return create(UpdateOrganizationRequisitesResponseSchema, { requisites });
        },
      });
    },
  });

  render(withTestLocalizer(
    <RoutingProvider location={location}>
      <LiveRegionProvider>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
            <RequisitesPanel onClose={onClose} />
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </LiveRegionProvider>
    </RoutingProvider>,
  ));

  return { location, onClose, update };
};

const getAddressInput = async (): Promise<HTMLInputElement> => {
  const element = await screen.findByLabelText(ADDRESS_LABEL);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError('The address is not an input');
  }

  return element;
};

const typeAddress = async (): Promise<HTMLInputElement> => {
  const address = await getAddressInput();

  fireEvent.change(address, { target: { value: TYPED_ADDRESS } });
  await waitFor(() => {
    expect(address.value).toBe(TYPED_ADDRESS);
  });

  return address;
};

const click = (testId: string): void => {
  act(() => {
    screen.getByTestId(testId).click();
  });
};

describe('RequisitesPanel leaving', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('leaves at once through the back button and through the address while nothing is typed', async () => {
    const { location, onClose } = renderPanel();
    await getAddressInput();

    act(() => {
      location.navigate('/deals');
    });

    expect(location.read().path).toBe('/deals');
    expect(screen.queryByTestId('requisites-leave-confirm')).toBeNull();

    click('requisites-panel-back');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before an address change, keeps the typed text and the address when the user stays', async () => {
    const { location } = renderPanel();
    const address = await typeAddress();

    act(() => {
      location.navigate('/deals');
    });

    expect(screen.getByTestId('requisites-leave-confirm')).toBeTruthy();
    expect(location.read().path).toBe('/network');

    click('requisites-leave-confirm-stay');

    expect(screen.queryByTestId('requisites-leave-confirm')).toBeNull();
    expect(location.read().path).toBe('/network');
    expect((await getAddressInput()).value).toBe(TYPED_ADDRESS);
    expect(address.isConnected).toBe(true);
    expect(document.activeElement).toBe(screen.getByTestId('requisites-panel-back'));
  });

  it('moves the focus to the question and goes to the address when the user leaves', async () => {
    const { location } = renderPanel();
    await typeAddress();

    act(() => {
      location.navigate('/deals');
    });

    expect(document.activeElement).toBe(screen.getByTestId('requisites-leave-confirm'));

    click('requisites-leave-confirm-leave');

    expect(location.read().path).toBe('/deals');
  });

  it('asks before the back button closes the panel and closes it only after the answer', async () => {
    const { onClose } = renderPanel();
    await typeAddress();

    click('requisites-panel-back');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('requisites-leave-confirm')).toBeTruthy();

    click('requisites-leave-confirm-stay');

    expect(onClose).not.toHaveBeenCalled();

    click('requisites-panel-back');
    click('requisites-leave-confirm-leave');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks again before the step back of the browser after the user left and the panel stayed', async () => {
    const { location } = renderPanel();
    await typeAddress();

    act(() => {
      location.navigate('/deals');
    });
    click('requisites-leave-confirm-leave');
    act(() => {
      location.back();
    });

    expect(location.currentIndex).toBe(1);
    expect(screen.getByTestId('requisites-leave-confirm')).toBeTruthy();

    click('requisites-leave-confirm-leave');

    expect(location.currentIndex).toBe(0);
  });

  it('stops asking after the typed text is saved', async () => {
    const { location, update } = renderPanel();
    await typeAddress();

    fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: SUBMIT_LABEL }).getAttribute('aria-busy')).toBeNull();
    });
    act(() => {
      location.navigate('/deals');
    });

    expect(screen.queryByTestId('requisites-leave-confirm')).toBeNull();
    expect(location.read().path).toBe('/deals');
  });
});
