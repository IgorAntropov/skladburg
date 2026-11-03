import type {
  SalesTerms,
  SaveSalesTermsRequest,
} from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  CatalogService,
  GetSalesTermsResponseSchema,
  SalesTermsSchema,
  SaveSalesTermsResponseSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  ErrorCode,
  ErrorDetailSchema,
  FieldViolationSchema,
  ValidationFailedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
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
import { LiveRegionProvider } from '@/shared/ui';

import { CatalogTextsGate } from '../CatalogTextsGate';
import { SalesTermsForm } from './SalesTermsForm';

interface ServerValue {
  current: SalesTerms;
  save: ReturnType<typeof vi.fn<(request: SaveSalesTermsRequest) => void>>;
}

vi.mock('@/entities/session', () => ({
  useCan: () => true,
  useCommandAccess: () => ({ status: 'allowed' }),
}));

const RUB = 'RUB';

const createTerms = (overrides: Partial<{
  isAutoConfirmEnabled: boolean;
  ownDelivery: undefined | { minimumCharge: bigint; pricePerKm: bigint };
  preparationWorkingDays: number;
  version: bigint;
}> = {}): SalesTerms => create(SalesTermsSchema, {
  isAutoConfirmEnabled: overrides.isAutoConfirmEnabled ?? false,
  organizationId: 'a0000001-0000-4000-8000-000000000009',
  ownDelivery: overrides.ownDelivery === undefined
    ? undefined
    : {
        minimumCharge: { amountMinor: overrides.ownDelivery.minimumCharge, currencyCode: RUB },
        pricePerKm: { amountMinor: overrides.ownDelivery.pricePerKm, currencyCode: RUB },
      },
  preparationWorkingDays: overrides.preparationWorkingDays ?? 1,
  version: overrides.version ?? 3n,
});

const createFailure = (code: ErrorCode, violations: [string, string][] = []): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{
    desc: ErrorDetailSchema,
    value: create(ErrorDetailSchema, {
      code,
      params: code === ErrorCode.VALIDATION_FAILED
        ? {
            case: 'validationFailed',
            value: create(ValidationFailedParamsSchema, {
              violations: violations.map(([fieldPath, ruleId]) => create(FieldViolationSchema, { fieldPath, ruleId })),
            }),
          }
        : { case: undefined },
    }),
  }],
);

const createServer = (current: SalesTerms): ServerValue => ({
  current,
  save: vi.fn<(request: SaveSalesTermsRequest) => void>(),
});

const renderForm = (server: ServerValue, onClose: () => void = () => undefined): void => {
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(CatalogService, {
        getSalesTerms: () => create(GetSalesTermsResponseSchema, { terms: server.current }),
        saveSalesTerms: (request) => {
          server.save(request);

          return create(SaveSalesTermsResponseSchema, { terms: server.current });
        },
      });
    },
  });

  render(withTestLocalizer(
    <LiveRegionProvider>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
          <CatalogTextsGate skeleton={null}>
            <SalesTermsForm onClose={onClose} terms={server.current} />
          </CatalogTextsGate>
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LiveRegionProvider>,
  ));
};

const getInput = (testId: string): HTMLInputElement => {
  const element = document.querySelector(`[data-testid="${testId}"] input`);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`The field ${testId} is not an input`);
  }

  return element;
};

const getSwitch = (testId: string): HTMLInputElement => within(screen.getByTestId(testId)).getByRole('switch');

const typeText = (input: HTMLInputElement, text: string): void => {
  for (const symbol of text) {
    const caret = input.selectionStart ?? input.value.length;
    const nextValue = input.value.slice(0, caret) + symbol + input.value.slice(input.selectionEnd ?? caret);

    act(() => {
      Reflect.set(HTMLInputElement.prototype, 'value', nextValue, input);
      input.setSelectionRange(caret + 1, caret + 1);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: symbol, inputType: 'insertText' }));
    });
  }
};

const click = (element: HTMLElement): void => {
  act(() => {
    element.click();
  });
};

const waitForForm = async (): Promise<void> => {
  await screen.findByTestId('sales-terms-save');
};

describe('sales terms form', () => {
  afterEach(() => {
    cleanup();
  });

  it('hides the delivery fields while the switch is off and shows them when it is turned on', async () => {
    renderForm(createServer(createTerms()));
    await waitForForm();

    const switchInput = getSwitch('sales-terms-own-delivery');
    const fields = document.getElementById(switchInput.getAttribute('aria-controls') ?? '');

    expect(switchInput.checked).toBe(false);
    expect(fields?.hidden).toBe(true);

    click(switchInput);

    expect(fields?.hidden).toBe(false);
  });

  it('does not send the own delivery when the switch is off and keeps the typed amounts for the next turn on', async () => {
    const server = createServer(createTerms());
    renderForm(server);
    await waitForForm();

    click(getSwitch('sales-terms-own-delivery'));
    typeText(getInput('sales-terms-price-per-km'), '45');
    typeText(getInput('sales-terms-minimum-charge'), '1500');
    click(getSwitch('sales-terms-own-delivery'));

    expect(getInput('sales-terms-price-per-km').value).toBe('45');

    click(screen.getByTestId('sales-terms-save'));

    await waitFor(() => {
      expect(server.save).toHaveBeenCalledTimes(1);
    });
    expect(server.save.mock.calls[0]?.[0].ownDelivery).toBeUndefined();

    click(getSwitch('sales-terms-own-delivery'));

    expect(getInput('sales-terms-minimum-charge').value).toBe('1 500');
  });

  it('sends the own delivery in kopecks with the days and the automatic confirmation, then closes', async () => {
    const server = createServer(createTerms({ preparationWorkingDays: 2 }));
    const onClose = vi.fn<() => void>();
    renderForm(server, onClose);
    await waitForForm();

    click(getSwitch('sales-terms-auto-confirm'));
    click(getSwitch('sales-terms-own-delivery'));
    typeText(getInput('sales-terms-price-per-km'), '45,5');
    typeText(getInput('sales-terms-minimum-charge'), '1500');
    click(screen.getByTestId('sales-terms-save'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(server.save.mock.calls[0]?.[0]).toMatchObject({
      expectedVersion: 3n,
      isAutoConfirmEnabled: true,
      ownDelivery: {
        minimumCharge: { amountMinor: 150000n, currencyCode: RUB },
        pricePerKm: { amountMinor: 4550n, currencyCode: RUB },
      },
      preparationWorkingDays: 2,
    });
  });

  it('asks for both amounts of an enabled delivery and sends nothing', async () => {
    const server = createServer(createTerms());
    renderForm(server);
    await waitForForm();

    click(getSwitch('sales-terms-own-delivery'));
    click(screen.getByTestId('sales-terms-save'));

    await waitFor(() => {
      expect(getInput('sales-terms-price-per-km').getAttribute('aria-invalid')).toBe('true');
    });
    expect(getInput('sales-terms-minimum-charge').getAttribute('aria-invalid')).toBe('true');
    expect(getInput('sales-terms-preparation-days').getAttribute('aria-invalid')).toBeNull();
    expect(server.save).not.toHaveBeenCalled();
  });

  it('rejects the days outside the range from zero to thirty', async () => {
    const server = createServer(createTerms({ preparationWorkingDays: 3 }));
    renderForm(server);
    await waitForForm();

    typeText(getInput('sales-terms-preparation-days'), '1');
    click(screen.getByTestId('sales-terms-save'));

    await waitFor(() => {
      expect(getInput('sales-terms-preparation-days').getAttribute('aria-invalid')).toBe('true');
    });
    expect(screen.getByText('Срок подготовки: от 0 до 30 рабочих дней')).toBeTruthy();
    expect(server.save).not.toHaveBeenCalled();
  });

  it('puts the error of the server about the price per kilometer under that field', async () => {
    const server = createServer(createTerms({ ownDelivery: { minimumCharge: 100000n, pricePerKm: 4500n } }));
    server.save.mockImplementation(() => {
      throw createFailure(ErrorCode.VALIDATION_FAILED, [['own_delivery.price_per_km.amount_minor', 'catalog.amount_above_limit']]);
    });
    renderForm(server);
    await waitForForm();

    click(screen.getByTestId('sales-terms-save'));

    await waitFor(() => {
      expect(getInput('sales-terms-price-per-km').getAttribute('aria-invalid')).toBe('true');
    });
    expect(screen.getByText('Слишком большая сумма')).toBeTruthy();
    expect(getInput('sales-terms-minimum-charge').getAttribute('aria-invalid')).toBeNull();
  });

  it('offers to reload after a conflict of versions and fills the form from the fresh terms', async () => {
    const server = createServer(createTerms({ version: 3n }));
    server.save.mockImplementation(() => {
      throw createFailure(ErrorCode.VERSION_CONFLICT);
    });
    renderForm(server);
    await waitForForm();

    click(screen.getByTestId('sales-terms-save'));

    const reload = await screen.findByTestId('sales-terms-reload');
    expect(screen.getByText('Пока вы смотрели, данные обновились')).toBeTruthy();

    server.current = createTerms({ ownDelivery: { minimumCharge: 250000n, pricePerKm: 5000n }, preparationWorkingDays: 4, version: 5n });
    click(reload);

    await waitFor(() => {
      expect(getInput('sales-terms-preparation-days').value).toBe('4');
    });
    expect(getSwitch('sales-terms-own-delivery').checked).toBe(true);
    expect(getInput('sales-terms-minimum-charge').value).toBe('2 500,00');
    expect(screen.queryByTestId('sales-terms-reload')).toBeNull();
  });

  it('closes with the cancel button and with the escape key', async () => {
    const onClose = vi.fn<() => void>();
    renderForm(createServer(createTerms()), onClose);
    await waitForForm();

    click(screen.getByTestId('sales-terms-cancel'));
    act(() => {
      getInput('sales-terms-preparation-days').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
