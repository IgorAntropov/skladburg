import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
  FieldViolationSchema,
  ValidationFailedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { runFieldCheck } from '@skladburg/contracts/forms';
import { UpdateOrganizationRequisitesRequestFormRules } from '@skladburg/contracts/forms/organization/v1/requisites';
import { VatMode } from '@skladburg/contracts/organization/v1/requisites';
import { QueryClientProvider } from '@tanstack/react-query';
import {
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

import { createQueryClient } from '@/shared/api';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import {
  ActionButton,
  LiveRegionProvider,
} from '@/shared/ui';

import type { FormFieldBindingValue } from './commandFormTypes';

import { useCommandForm } from './useCommandForm';

type ExecuteValue = (values: RequisitesOutputValue, idempotencyKey: string) => Promise<string>;

type FieldNameValue = 'bank.bik' | 'bank.settlementAccount' | 'legalAddress' | 'vatMode';

interface RequisitesInputValue {
  bank: { bik: string; settlementAccount: string };
  legalAddress: string;
  vatMode: string;
}

interface RequisitesOutputValue {
  bank: { bik: string; settlementAccount: string };
  legalAddress: string;
  vatMode: VatMode;
}

const SUBMIT_LABEL = 'Сохранить';
const CHECK_FAILED_TEXT = 'Счёт не сходится с БИК';
const BIK = '040000501';
const ACCOUNT = '40702810300000000001';
const WRONG_KEY_ACCOUNT = '40702810400000000001';
const FIELD_ORDER: FieldNameValue[] = ['legalAddress', 'vatMode', 'bank.bik', 'bank.settlementAccount'];

const DEFAULT_VALUES: RequisitesInputValue = {
  bank: { bik: BIK, settlementAccount: ACCOUNT },
  legalAddress: 'г. Вымышленск, ул. Тестовая, д. 1',
  vatMode: String(VatMode.GENERAL),
};

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

const translateCheck = (ruleId: string): string | undefined =>
  ruleId.startsWith('field_check.') ? CHECK_FAILED_TEXT : undefined;

interface TestFieldProps {
  binding: FormFieldBindingValue;
}

const TestField = ({ binding }: TestFieldProps): ReactElement => {
  const {
    error,
    name,
    onBlur,
    onChange,
    ref,
  } = binding;

  return (
    <div>
      <input data-testid={name} name={name} onBlur={onBlur} onChange={onChange} ref={ref} />
      <p data-testid={`${name}-error`}>{error}</p>
    </div>
  );
};

interface RequisitesFormProps {
  execute: ExecuteValue;
}

const RequisitesForm = ({ execute }: RequisitesFormProps): ReactElement => {
  const { command, getFieldProps, handleSubmit } = useCommandForm<RequisitesInputValue, string, RequisitesOutputValue>({
    defaultValues: DEFAULT_VALUES,
    execute,
    rules: UpdateOrganizationRequisitesRequestFormRules,
    runCheck: runFieldCheck,
    translateViolation: translateCheck,
  });

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELD_ORDER.map(name => <TestField binding={getFieldProps(name)} key={name} />)}
      <ActionButton access={{ status: 'allowed' }} command={command} type="submit">{SUBMIT_LABEL}</ActionButton>
    </form>
  );
};

const renderForm = (execute: ExecuteValue): void => {
  render(withTestLocalizer(
    <LiveRegionProvider>
      <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
        <RequisitesForm execute={execute} />
      </QueryClientProvider>
    </LiveRegionProvider>,
  ));
};

const getInput = (name: FieldNameValue): HTMLInputElement => {
  const element = screen.getByTestId(name);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`The field ${name} is not an input`);
  }

  return element;
};

const getErrorText = (name: FieldNameValue): string => screen.getByTestId(`${name}-error`).textContent;

const fillDefaults = (): void => {
  fireEvent.change(getInput('legalAddress'), { target: { value: DEFAULT_VALUES.legalAddress } });
  fireEvent.change(getInput('vatMode'), { target: { value: DEFAULT_VALUES.vatMode } });
  fireEvent.change(getInput('bank.bik'), { target: { value: BIK } });
  fireEvent.change(getInput('bank.settlementAccount'), { target: { value: ACCOUNT } });
};

const typeInto = (name: FieldNameValue, value: string): void => {
  fireEvent.change(getInput(name), { target: { value } });
};

const pressSubmit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));
};

describe('useCommandForm with nested fields', () => {
  afterEach(() => {
    cleanup();
  });

  it('sends the nested values with the output type that differs from the input type', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve('saved'));
    renderForm(execute);
    fillDefaults();

    pressSubmit();

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(execute.mock.calls[0]?.[0]).toEqual({
      bank: { bik: BIK, settlementAccount: ACCOUNT },
      legalAddress: DEFAULT_VALUES.legalAddress,
      vatMode: VatMode.GENERAL,
    });
  });

  it('shows a broken nested field under its path and focuses it', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve('saved'));
    renderForm(execute);
    fillDefaults();
    typeInto('bank.bik', '12');

    pressSubmit();

    await waitFor(() => {
      expect(getErrorText('bank.bik')).not.toBe('');
    });
    expect(execute).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getInput('bank.bik'));
  });

  it('shows the text of a failed check under the nested account and does not send the form', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve('saved'));
    renderForm(execute);
    fillDefaults();
    typeInto('bank.settlementAccount', WRONG_KEY_ACCOUNT);

    pressSubmit();

    await waitFor(() => {
      expect(getErrorText('bank.settlementAccount')).toBe(CHECK_FAILED_TEXT);
    });
    expect(getErrorText('bank.bik')).toBe('');
    expect(execute).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getInput('bank.settlementAccount'));
  });

  it('puts a violation of the server under the nested field of the form', async () => {
    const execute = vi.fn<ExecuteValue>()
      .mockRejectedValueOnce(createValidationError([['bank.settlement_account', 'field_check.settlement_account']]));
    renderForm(execute);
    fillDefaults();

    pressSubmit();

    await waitFor(() => {
      expect(getErrorText('bank.settlementAccount')).toBe(CHECK_FAILED_TEXT);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(getInput('bank.settlementAccount'));
    });
  });

  it('shows a violation of the server without a field of the form as a general text', async () => {
    const execute = vi.fn<ExecuteValue>()
      .mockRejectedValueOnce(createValidationError([['signatories[0].full_name', 'string.min_len']]));
    renderForm(execute);
    fillDefaults();

    pressSubmit();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(getErrorText('bank.settlementAccount')).toBe('');
  });
});
