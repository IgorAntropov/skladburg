import type { ReactElement } from 'react';

import { runFieldCheck } from '@skladburg/contracts/forms';
import { BankAccountFormRules } from '@skladburg/contracts/forms/organization/v1/requisites';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
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

import { createQueryClient } from '@/shared/api';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { createDigitMask } from '@/shared/lib/mask';
import {
  ActionButton,
  LiveRegionProvider,
  TextField,
} from '@/shared/ui';

import { useCommandForm } from './useCommandForm';

interface BankFormValues {
  bankName: string;
  bik: string;
  correspondentAccount: string;
  settlementAccount: string;
}

type ExecuteValue = (values: BankFormValues, idempotencyKey: string) => Promise<undefined>;

const SUBMIT_LABEL = 'Сохранить';
const BIK_LABEL = 'БИК';
const ACCOUNT_LABEL = 'Расчётный счёт';
const BANK_LABEL = 'Банк';
const ACCOUNT_FIELD = 'settlementAccount';

const BIK_MASK = createDigitMask('#########');
const ACCOUNT_MASK = createDigitMask('##### ### # #### #######');

const ACCOUNT = '40702810300000000001';
const FORMATTED_ACCOUNT = '40702 810 3 0000 0000001';
const WRONG_KEY_ACCOUNT = '40702810400000000001';
const CHECK_FAILED_TEXT = 'Счёт не сходится с БИК';

const DEFAULT_VALUES: BankFormValues = {
  bankName: 'Банк «Север»',
  bik: '040000501',
  correspondentAccount: '30101810600000000501',
  settlementAccount: '',
};

interface BankFormProps {
  defaultValues?: BankFormValues | undefined;
  execute: ExecuteValue;
  isChecked: boolean;
}

const translateCheck = (ruleId: string): string | undefined =>
  ruleId.startsWith('field_check.') ? CHECK_FAILED_TEXT : undefined;

const BankForm = ({ defaultValues = DEFAULT_VALUES, execute, isChecked }: BankFormProps): ReactElement => {
  const { command, getFieldProps, handleSubmit } = useCommandForm<BankFormValues, undefined>({
    defaultValues,
    execute,
    rules: BankAccountFormRules,
    runCheck: isChecked ? runFieldCheck : undefined,
    translateViolation: translateCheck,
  });

  return (
    <form noValidate onSubmit={handleSubmit}>
      <TextField {...getFieldProps('bik', { mask: BIK_MASK })} label={BIK_LABEL} />
      <TextField {...getFieldProps('settlementAccount', { mask: ACCOUNT_MASK })} label={ACCOUNT_LABEL} />
      <TextField {...getFieldProps('bankName')} label={BANK_LABEL} />
      <ActionButton access={{ status: 'allowed' }} command={command} type="submit">{SUBMIT_LABEL}</ActionButton>
    </form>
  );
};

const renderForm = (execute: ExecuteValue, defaultValues?: BankFormValues, isChecked = false): void => {
  render(withTestLocalizer(
    <LiveRegionProvider>
      <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
        <BankForm defaultValues={defaultValues} execute={execute} isChecked={isChecked} />
      </QueryClientProvider>
    </LiveRegionProvider>,
  ));
};

const getInput = (name: keyof BankFormValues): HTMLInputElement => {
  const element = document.querySelector(`input[name="${name}"]`);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`The field ${name} is not an input`);
  }

  return element;
};

const replaceRange = (input: HTMLInputElement, start: number, end: number, text: string, inputType: string): void => {
  const nextValue = input.value.slice(0, start) + text + input.value.slice(end);
  const caret = start + text.length;

  act(() => {
    Reflect.set(HTMLInputElement.prototype, 'value', nextValue, input);
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType }));
  });
};

const typeText = (input: HTMLInputElement, text: string): void => {
  for (const symbol of text) {
    const caret = input.selectionStart ?? input.value.length;

    replaceRange(input, caret, input.selectionEnd ?? caret, symbol, 'insertText');
  }
};

const pasteText = (input: HTMLInputElement, text: string): void => {
  const start = input.selectionStart ?? input.value.length;

  replaceRange(input, start, input.selectionEnd ?? start, text, 'insertFromPaste');
};

const deleteBackward = (input: HTMLInputElement): void => {
  const caret = input.selectionStart ?? input.value.length;

  if (caret > 0) {
    replaceRange(input, caret - 1, caret, '', 'deleteContentBackward');
  }
};

const placeCaret = (input: HTMLInputElement, position: number): void => {
  input.setSelectionRange(position, position);
};

const clearField = (input: HTMLInputElement): void => {
  replaceRange(input, 0, input.value.length, '', 'deleteContentBackward');
};

const pressSubmit = (): void => {
  act(() => {
    screen.getByRole('button', { name: SUBMIT_LABEL }).click();
  });
};

const readSubmittedValues = async (execute: ReturnType<typeof vi.fn<ExecuteValue>>): Promise<BankFormValues | undefined> => {
  await waitFor(() => {
    expect(execute).toHaveBeenCalledTimes(1);
  });

  return execute.mock.calls[0]?.[0];
};

describe('useCommandForm with an input mask', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the initial value of the form with the mask and keeps it bare in the form', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute, { ...DEFAULT_VALUES, settlementAccount: ACCOUNT });

    await waitFor(() => {
      expect(getInput(ACCOUNT_FIELD).value).toBe(FORMATTED_ACCOUNT);
    });
    pressSubmit();

    expect((await readSubmittedValues(execute))?.settlementAccount).toBe(ACCOUNT);
  });

  it('gives the form the bare digits of a typed value and shows the separators', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute);
    const input = getInput(ACCOUNT_FIELD);

    typeText(input, ACCOUNT);

    expect(input.value).toBe(FORMATTED_ACCOUNT);
    pressSubmit();
    expect((await readSubmittedValues(execute))?.settlementAccount).toBe(ACCOUNT);
  });

  it('ignores letters, signs and the digits over the length', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute);
    const input = getInput(ACCOUNT_FIELD);

    typeText(input, `4a0-7.0 2${ACCOUNT.slice(5)}999`);

    expect(input.value).toBe(FORMATTED_ACCOUNT);
    pressSubmit();
    expect((await readSubmittedValues(execute))?.settlementAccount).toBe(ACCOUNT);
  });

  it.each([
    ['bare digits', ACCOUNT],
    ['digits with the separators', FORMATTED_ACCOUNT],
    ['digits with other separators', '40702-810-3-0000-0000001'],
  ])('gives the same bare value for a paste of %s', async (_title, pasted) => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute);
    const input = getInput(ACCOUNT_FIELD);

    pasteText(input, pasted);

    expect(input.value).toBe(FORMATTED_ACCOUNT);
    pressSubmit();
    expect((await readSubmittedValues(execute))?.settlementAccount).toBe(ACCOUNT);
  });

  it.each([
    {
      caret: 13,
      digits: '40702810350000000001',
      editedCaret: 12,
      editedValue: '40702 810 3 0000 000001',
      value: '40702 810 3 5000 0000001',
      valueCaret: 13,
    },
    {
      caret: 3,
      digits: '40502810300000000001',
      editedCaret: 2,
      editedValue: '40028 103 0 0000 000001',
      value: '40502 810 3 0000 0000001',
      valueCaret: 3,
    },
  ])('keeps the form value bare and the caret in place when a digit is replaced in the middle at $caret', async (scenario) => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute);
    const input = getInput(ACCOUNT_FIELD);
    pasteText(input, ACCOUNT);

    placeCaret(input, scenario.caret);
    deleteBackward(input);

    expect(input.value).toBe(scenario.editedValue);
    expect(input.selectionStart).toBe(scenario.editedCaret);

    typeText(input, '5');

    expect(input.value).toBe(scenario.value);
    expect(input.selectionStart).toBe(scenario.valueCaret);
    pressSubmit();
    expect((await readSubmittedValues(execute))?.settlementAccount).toBe(scenario.digits);
  });

  it('keeps the digits when a separator is deleted', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute);
    const input = getInput(ACCOUNT_FIELD);
    pasteText(input, ACCOUNT);

    placeCaret(input, 12);
    deleteBackward(input);

    expect(input.value).toBe(FORMATTED_ACCOUNT);
    pressSubmit();
    expect((await readSubmittedValues(execute))?.settlementAccount).toBe(ACCOUNT);
  });

  it('erases through a separator from the end of the value', () => {
    renderForm(vi.fn<ExecuteValue>(() => Promise.resolve(undefined)));
    const input = getInput(ACCOUNT_FIELD);
    typeText(input, '407028');

    deleteBackward(input);
    deleteBackward(input);
    deleteBackward(input);

    expect(input.value).toBe('4070');

    clearField(input);

    expect(input.value).toBe('');
  });

  it('sends an account whose key matches the BIK when the checks are on', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute, undefined, true);
    pasteText(getInput(ACCOUNT_FIELD), ACCOUNT);

    pressSubmit();

    expect((await readSubmittedValues(execute))?.settlementAccount).toBe(ACCOUNT);
  });

  it('shows the text of a failed check under the account and does not send the form', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute, undefined, true);
    const input = getInput(ACCOUNT_FIELD);
    pasteText(input, WRONG_KEY_ACCOUNT);

    pressSubmit();

    expect(await screen.findByText(CHECK_FAILED_TEXT)).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
  });
});
