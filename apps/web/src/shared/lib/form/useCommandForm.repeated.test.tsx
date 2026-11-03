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
import {
  PriceTierFormRules,
  SaveListingPriceRequestFormRules,
} from '@skladburg/contracts/forms/catalog/v1/catalog';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
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
  createMoneyMask,
  createQuantityMask,
} from '@/shared/lib/mask';
import {
  ActionButton,
  LiveRegionProvider,
  TextField,
} from '@/shared/ui';

import { expandRepeatedFormRules } from './expandRepeatedFormRules';
import { useCommandForm } from './useCommandForm';

type ExecuteValue = (tiers: TierOutputValue[]) => Promise<undefined>;

interface PriceFormOutput {
  tiers: TierOutputValue[];
}

interface PriceFormValues {
  tiers: TierInputValue[];
}

interface TierInputValue {
  minQuantity: string;
  price: { amountMinor: string; currencyCode: string };
}

interface TierOutputValue {
  minQuantity?: bigint | undefined;
  price: { amountMinor?: bigint | undefined; currencyCode: string };
}

const CAPACITY = 4;
const SUBMIT_LABEL = 'Сохранить';
const REMOVE_LABEL = 'Убрать';
const QUANTITY_LABEL = 'Количество';
const PRICE_LABEL = 'Цена';
const RUB = 'RUB';

const RULES = expandRepeatedFormRules(SaveListingPriceRequestFormRules, 'tiers', PriceTierFormRules, CAPACITY);
const QUANTITY_MASK = createQuantityMask(1000n);
const PRICE_MASK = createMoneyMask();

const createTier = (minQuantity: string, amountMinor: string): TierInputValue => ({
  minQuantity,
  price: { amountMinor, currencyCode: RUB },
});

const createDefaultTiers = (filled: TierInputValue[]): TierInputValue[] =>
  Array.from({ length: CAPACITY }, (_item, index) => filled[index] ?? createTier('', ''));

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

const ROW_PATHS = [
  { price: 'tiers.0.price.amountMinor', quantity: 'tiers.0.minQuantity' },
  { price: 'tiers.1.price.amountMinor', quantity: 'tiers.1.minQuantity' },
  { price: 'tiers.2.price.amountMinor', quantity: 'tiers.2.minQuantity' },
  { price: 'tiers.3.price.amountMinor', quantity: 'tiers.3.minQuantity' },
] as const;

const translateRule = (ruleId: string): string => `Ошибка ${ruleId}`;

interface PriceFormProps {
  execute: ExecuteValue;
  filled: TierInputValue[];
}

const PriceForm = ({ execute, filled }: PriceFormProps): ReactElement => {
  const [count, setCount] = useState(filled.length);
  const {
    command,
    getFieldProps,
    handleSubmit,
    setFieldValue,
    watchField,
  } = useCommandForm<PriceFormValues, undefined, PriceFormOutput>({
    defaultValues: { tiers: createDefaultTiers(filled) },
    execute: values => execute(values.tiers.slice(0, count)),
    rules: RULES,
    translateViolation: translateRule,
  });

  const handleRemoveClick = (removedIndex: number): void => {
    for (const [index, row] of ROW_PATHS.entries()) {
      const nextRow = ROW_PATHS[index + 1];
      const isShifted = index >= removedIndex && index < count;

      if (isShifted) {
        setFieldValue(row.quantity, nextRow === undefined || index + 1 >= count ? '' : watchField(nextRow.quantity));
        setFieldValue(row.price, nextRow === undefined || index + 1 >= count ? '' : watchField(nextRow.price));
      }
    }

    setCount(count - 1);
  };

  return (
    <form noValidate onSubmit={handleSubmit}>
      {ROW_PATHS.slice(0, count).map((row, index) => (
        <fieldset key={row.price}>
          <TextField {...getFieldProps(row.quantity, { mask: QUANTITY_MASK })} label={QUANTITY_LABEL} />
          <TextField {...getFieldProps(row.price, { mask: PRICE_MASK })} label={PRICE_LABEL} />
          <button onClick={() => { handleRemoveClick(index); }} type="button">{REMOVE_LABEL}</button>
        </fieldset>
      ))}
      <ActionButton access={{ status: 'allowed' }} command={command} type="submit">{SUBMIT_LABEL}</ActionButton>
    </form>
  );
};

const renderForm = (execute: ExecuteValue, filled: TierInputValue[]): void => {
  render(withTestLocalizer(
    <LiveRegionProvider>
      <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
        <PriceForm execute={execute} filled={filled} />
      </QueryClientProvider>
    </LiveRegionProvider>,
  ));
};

const getInput = (name: string): HTMLInputElement => {
  const element = document.querySelector(`input[name="${name}"]`);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`The field ${name} is not an input`);
  }

  return element;
};

const getQuantity = (index: number): HTMLInputElement => getInput(ROW_PATHS[index]?.quantity ?? '');

const getPrice = (index: number): HTMLInputElement => getInput(ROW_PATHS[index]?.price ?? '');

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

const pressSubmit = (): void => {
  act(() => {
    screen.getByRole('button', { name: SUBMIT_LABEL }).click();
  });
};

const pressRemove = (index: number): void => {
  act(() => {
    screen.getAllByRole('button', { name: REMOVE_LABEL })[index]?.click();
  });
};

const THREE_TIERS = [createTier('1000', '8950'), createTier('10000', '8000'), createTier('100000', '7000')];

describe('useCommandForm with rows of a list', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the stored values of the rows with the masks and sends the rows that are shown', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute, THREE_TIERS);

    expect(getQuantity(1).value).toBe('10,000');
    expect(getPrice(1).value).toBe('80,00');
    expect(getPrice(2).value).toBe('70,00');

    pressSubmit();

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(execute.mock.calls[0]?.[0]).toEqual([
      { minQuantity: 1000n, price: { amountMinor: 8950n, currencyCode: RUB } },
      { minQuantity: 10000n, price: { amountMinor: 8000n, currencyCode: RUB } },
      { minQuantity: 100000n, price: { amountMinor: 7000n, currencyCode: RUB } },
    ]);
  });

  it('sends a typed value in the minimal units and keeps the text of the field after the send', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    renderForm(execute, [createTier('1000', '')]);
    typeText(getPrice(0), '95.5');

    pressSubmit();

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(execute.mock.calls[0]?.[0][0]).toEqual({ minQuantity: 1000n, price: { amountMinor: 9550n, currencyCode: RUB } });
    expect(getPrice(0).value).toBe('95,5');
  });

  it('puts the violation of the server under the price field of the third row', async () => {
    const execute = vi.fn<ExecuteValue>()
      .mockRejectedValueOnce(createValidationError([['tiers[2].price.amount_minor', 'tier.price_order']]));
    renderForm(execute, THREE_TIERS);

    pressSubmit();

    await waitFor(() => {
      expect(getPrice(2).getAttribute('aria-invalid')).toBe('true');
    });
    expect(screen.getByText('Ошибка tier.price_order')).toBeTruthy();
    expect(getPrice(0).getAttribute('aria-invalid')).toBeNull();
    expect(getPrice(1).getAttribute('aria-invalid')).toBeNull();
    expect(getQuantity(2).getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(getPrice(2));
    });
  });

  it('keeps the index of the server error equal to the row after the second row is removed', async () => {
    const execute = vi.fn<ExecuteValue>()
      .mockRejectedValueOnce(createValidationError([['tiers[1].price.amount_minor', 'tier.price_order']]));
    renderForm(execute, THREE_TIERS);

    pressRemove(1);

    expect(getQuantity(1).value).toBe('100,000');
    expect(getPrice(1).value).toBe('70,00');
    expect(screen.getAllByRole('button', { name: REMOVE_LABEL })).toHaveLength(2);

    pressSubmit();

    await waitFor(() => {
      expect(getPrice(1).getAttribute('aria-invalid')).toBe('true');
    });
    expect(execute.mock.calls[0]?.[0]).toEqual([
      { minQuantity: 1000n, price: { amountMinor: 8950n, currencyCode: RUB } },
      { minQuantity: 100000n, price: { amountMinor: 7000n, currencyCode: RUB } },
    ]);
    expect(getPrice(0).getAttribute('aria-invalid')).toBeNull();
  });
});
