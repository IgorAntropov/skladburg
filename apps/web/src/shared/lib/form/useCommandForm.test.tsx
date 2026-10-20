import type { CreateWarehouseResponse } from '@skladburg/contracts/organization/v1/organization';
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
import { CreateWarehouseRequestFormRules } from '@skladburg/contracts/forms/organization/v1/organization';
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

import { createQueryClient } from '@/shared/api';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { ActionButton } from '@/shared/ui';

import type { FormFieldBindingValue } from './commandFormTypes';

import { useCommandForm } from './useCommandForm';

type ExecuteValue = (values: WarehouseFormValues, idempotencyKey: string) => Promise<CreateWarehouseResponse>;

type FieldNameValue = keyof WarehouseFormValues;

interface WarehouseFormValues {
  address: string;
  boardNodeId: string;
  cityId: string;
  name: string;
  timeZone: string;
}

const DOM_ORDER: FieldNameValue[] = ['name', 'cityId', 'boardNodeId', 'timeZone', 'address'];

const SUBMIT_LABEL = 'Добавить склад';
const RETRY_LABEL = defaultLocaleCatalog['common.retry'];
const FORM_MESSAGE = defaultLocaleCatalog['error.validation_failed'];

const CITY_ID = '0b9c1f3e-6d4a-4e55-8f1d-7a2b3c4d5e6f';
const BOARD_NODE_ID = '1c0d2a4f-7e5b-4f66-9a2e-8b3c4d5e6f70';

const VALID_VALUES: WarehouseFormValues = {
  address: '',
  boardNodeId: BOARD_NODE_ID,
  cityId: CITY_ID,
  name: 'Склад «Север»',
  timeZone: 'Europe/Moscow',
};

const DEFAULT_VALUES: WarehouseFormValues = {
  address: '',
  boardNodeId: '',
  cityId: '',
  name: '',
  timeZone: '',
};

const createResponse = (): CreateWarehouseResponse => create(CreateWarehouseResponseSchema, {});

const createDetailError = (code: ErrorCode, violations: [string, string][] = []): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{
    desc: ErrorDetailSchema,
    value: create(ErrorDetailSchema, {
      code,
      params: violations.length === 0
        ? { case: undefined }
        : {
            case: 'validationFailed',
            value: create(ValidationFailedParamsSchema, {
              violations: violations.map(([fieldPath, ruleId]) => create(FieldViolationSchema, { fieldPath, ruleId })),
            }),
          },
    }),
  }],
);

const createValidationError = (violations: [string, string][]): ConnectError =>
  createDetailError(ErrorCode.VALIDATION_FAILED, violations);

const createUnavailableError = (): ConnectError => createDetailError(ErrorCode.UNAVAILABLE);

interface TestFieldProps {
  binding: FormFieldBindingValue;
}

const TestField = ({ binding }: TestFieldProps): ReactElement => {
  const {
    error,
    isReadOnly,
    name,
    onBlur,
    onChange,
    ref,
  } = binding;

  return (
    <div>
      <input
        aria-invalid={error === undefined ? undefined : true}
        data-testid={name}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        readOnly={isReadOnly}
        ref={ref}
      />
      <p data-testid={`${name}-error`}>{error}</p>
    </div>
  );
};

interface WarehouseFormProps {
  execute: ExecuteValue;
}

const WarehouseForm = ({ execute }: WarehouseFormProps): ReactElement => {
  const { command, getFieldProps, handleSubmit } = useCommandForm<WarehouseFormValues, CreateWarehouseResponse>({
    defaultValues: DEFAULT_VALUES,
    execute,
    method: OrganizationService.method.createWarehouse,
    rules: CreateWarehouseRequestFormRules,
  });

  return (
    <form noValidate onSubmit={handleSubmit}>
      {DOM_ORDER.map(name => <TestField binding={getFieldProps(name)} key={name} />)}
      <ActionButton access={{ status: 'allowed' }} command={command} type="submit">{SUBMIT_LABEL}</ActionButton>
    </form>
  );
};

const renderForm = (execute: ExecuteValue): void => {
  render(withTestLocalizer(
    <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
      <WarehouseForm execute={execute} />
    </QueryClientProvider>,
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

const typeInto = (name: FieldNameValue, value: string): void => {
  fireEvent.change(getInput(name), { target: { value } });
};

const fillValidValues = (): void => {
  for (const name of DOM_ORDER) {
    typeInto(name, VALID_VALUES[name]);
  }
};

const pressSubmit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));
};

const waitForIdle = async (): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: SUBMIT_LABEL }).getAttribute('aria-busy')).toBeNull();
  });
};

describe('useCommandForm', () => {
  afterEach(() => {
    cleanup();
  });

  describe('check before sending', () => {
    it('does not send a form that breaks the rules, shows the texts under the fields and focuses the first one', async () => {
      const execute = vi.fn<ExecuteValue>(() => Promise.resolve(createResponse()));
      renderForm(execute);

      pressSubmit();

      await waitFor(() => {
        expect(getErrorText('name')).toBe(defaultLocaleCatalog['validation.string.min_len']);
      });
      expect(getErrorText('cityId')).toBe(defaultLocaleCatalog['validation.string.uuid_empty']);
      expect(getErrorText('boardNodeId')).toBe(defaultLocaleCatalog['validation.string.uuid_empty']);
      expect(getErrorText('timeZone')).toBe(defaultLocaleCatalog['validation.string.pattern']);
      expect(getErrorText('address')).toBe('');
      expect(getInput('name').getAttribute('aria-invalid')).toBe('true');
      expect(execute).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(document.activeElement).toBe(getInput('name'));
      });
    });

    it('checks a corrected field again on every input and leaves the other fields alone', async () => {
      renderForm(vi.fn<ExecuteValue>(() => Promise.resolve(createResponse())));
      pressSubmit();
      await waitFor(() => {
        expect(getErrorText('name')).not.toBe('');
      });

      typeInto('name', 'С');

      await waitFor(() => {
        expect(getErrorText('name')).toBe('');
      });
      expect(getErrorText('cityId')).not.toBe('');

      typeInto('name', 'С'.repeat(121));

      await waitFor(() => {
        expect(getErrorText('name')).toBe(defaultLocaleCatalog['validation.string.max_len']);
      });
    });

    it('does not complain before the first send', () => {
      renderForm(vi.fn<ExecuteValue>(() => Promise.resolve(createResponse())));

      typeInto('timeZone', 'Moscow');

      expect(getErrorText('timeZone')).toBe('');
    });
  });

  describe('sending', () => {
    it('sends a correct form once with the typed values', async () => {
      const execute = vi.fn<ExecuteValue>(() => Promise.resolve(createResponse()));
      renderForm(execute);
      fillValidValues();

      pressSubmit();

      await waitFor(() => {
        expect(execute).toHaveBeenCalledTimes(1);
      });
      await waitForIdle();
      expect(execute.mock.calls[0]?.[0]).toEqual(VALID_VALUES);
      expect(typeof execute.mock.calls[0]?.[1]).toBe('string');
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('sends one command for two submits in the same tick', async () => {
      const execute = vi.fn<ExecuteValue>(() => Promise.resolve(createResponse()));
      renderForm(execute);
      fillValidValues();

      const form = screen.getByRole('button', { name: SUBMIT_LABEL }).closest('form');
      expect(form).not.toBeNull();
      if (form !== null) {
        fireEvent.submit(form);
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(execute).toHaveBeenCalledTimes(1);
      });
      await waitForIdle();
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('makes the fields read-only while the command is pending', async () => {
      let resolveExecute: (response: CreateWarehouseResponse) => void = () => undefined;
      const execute = vi.fn<ExecuteValue>(() => new Promise<CreateWarehouseResponse>((resolve) => {
        resolveExecute = resolve;
      }));
      renderForm(execute);
      fillValidValues();

      pressSubmit();

      await waitFor(() => {
        expect(getInput('name').readOnly).toBe(true);
      });
      expect(getInput('address').readOnly).toBe(true);

      resolveExecute(createResponse());

      await waitFor(() => {
        expect(getInput('name').readOnly).toBe(false);
      });
    });
  });

  describe('errors of the server', () => {
    it('puts the violations under the fields of the form and focuses the topmost one', async () => {
      const execute = vi.fn<ExecuteValue>()
        .mockRejectedValueOnce(createValidationError([
          ['city_id', 'string.uuid'],
          ['name', 'string.max_len'],
        ]));
      renderForm(execute);
      fillValidValues();

      pressSubmit();

      await waitFor(() => {
        expect(getErrorText('cityId')).toBe(defaultLocaleCatalog['validation.string.uuid']);
      });
      expect(getErrorText('name')).toBe(defaultLocaleCatalog['validation.string.max_len']);
      expect(screen.queryByRole('alert')).toBeNull();
      await waitFor(() => {
        expect(document.activeElement).toBe(getInput('name'));
      });
    });

    it('shows a violation without a field of the form as a general text', async () => {
      const execute = vi.fn<ExecuteValue>()
        .mockRejectedValueOnce(createValidationError([
          ['name', 'string.max_len'],
          ['idempotency_key', 'string.uuid'],
        ]));
      renderForm(execute);
      fillValidValues();

      pressSubmit();

      expect((await screen.findByRole('alert')).textContent).toBe(FORM_MESSAGE);
      await waitFor(() => {
        expect(getErrorText('name')).toBe(defaultLocaleCatalog['validation.string.max_len']);
      });
    });

    it('shows the general text when no violation belongs to the form', async () => {
      const execute = vi.fn<ExecuteValue>()
        .mockRejectedValueOnce(createValidationError([['idempotency_key', 'string.uuid']]));
      renderForm(execute);
      fillValidValues();

      pressSubmit();

      expect((await screen.findByRole('alert')).textContent).toBe(FORM_MESSAGE);
      expect(getErrorText('name')).toBe('');
    });

    it('puts the violations of the next answer under the fields again', async () => {
      const execute = vi.fn<ExecuteValue>()
        .mockRejectedValueOnce(createValidationError([['name', 'string.max_len']]))
        .mockRejectedValueOnce(createValidationError([['time_zone', 'string.pattern']]));
      renderForm(execute);
      fillValidValues();

      pressSubmit();
      await waitFor(() => {
        expect(getErrorText('name')).not.toBe('');
      });
      typeInto('name', 'Склад');
      await waitFor(() => {
        expect(getErrorText('name')).toBe('');
      });

      pressSubmit();

      await waitFor(() => {
        expect(getErrorText('timeZone')).toBe(defaultLocaleCatalog['validation.string.pattern']);
      });
      expect(execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry and key', () => {
    it('sends the next command with a new key after a field is changed', async () => {
      const execute = vi.fn<ExecuteValue>()
        .mockRejectedValueOnce(createUnavailableError())
        .mockResolvedValueOnce(createResponse());
      renderForm(execute);
      fillValidValues();

      pressSubmit();
      await screen.findByRole('alert');

      typeInto('address', 'Москва');

      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull();
      });
      pressSubmit();

      await waitFor(() => {
        expect(execute).toHaveBeenCalledTimes(2);
      });
      await waitForIdle();
      expect(execute.mock.calls[1]?.[1]).not.toBe(execute.mock.calls[0]?.[1]);
      expect(execute.mock.calls[1]?.[0].address).toBe('Москва');
    });

    it('retries with the same key when nothing was changed', async () => {
      const execute = vi.fn<ExecuteValue>()
        .mockRejectedValueOnce(createUnavailableError())
        .mockResolvedValueOnce(createResponse());
      renderForm(execute);
      fillValidValues();

      pressSubmit();
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: RETRY_LABEL }));

      await waitFor(() => {
        expect(execute).toHaveBeenCalledTimes(2);
      });
      await waitForIdle();
      expect(execute.mock.calls[1]?.[1]).toBe(execute.mock.calls[0]?.[1]);
      expect(execute.mock.calls[1]?.[0]).toEqual(execute.mock.calls[0]?.[0]);
    });

    it('keeps the key of a pending command when a field is touched', async () => {
      let rejectExecute: (error: Error) => void = () => undefined;
      const execute = vi.fn<ExecuteValue>()
        .mockImplementationOnce(() => new Promise<CreateWarehouseResponse>((_resolve, reject) => {
          rejectExecute = reject;
        }))
        .mockResolvedValueOnce(createResponse());
      renderForm(execute);
      fillValidValues();

      pressSubmit();
      await waitFor(() => {
        expect(getInput('name').readOnly).toBe(true);
      });
      typeInto('address', '');
      rejectExecute(createUnavailableError());
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: RETRY_LABEL }));

      await waitFor(() => {
        expect(execute).toHaveBeenCalledTimes(2);
      });
      await waitForIdle();
      expect(execute.mock.calls[1]?.[1]).toBe(execute.mock.calls[0]?.[1]);
    });
  });
});
