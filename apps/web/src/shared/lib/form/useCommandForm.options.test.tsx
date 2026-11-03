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
  TextField,
} from '@/shared/ui';

import { expandRepeatedFormRules } from './expandRepeatedFormRules';
import { useCommandForm } from './useCommandForm';

type ExecuteValue = (values: PriceFormOutput) => Promise<undefined>;

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

const CAPACITY = 3;
const SUBMIT_LABEL = 'Сохранить';
const RUB = 'RUB';

const RULES = expandRepeatedFormRules(SaveListingPriceRequestFormRules, 'tiers', PriceTierFormRules, CAPACITY);

const ROW_PATHS = [
  { price: 'tiers.0.price.amountMinor', quantity: 'tiers.0.minQuantity' },
  { price: 'tiers.1.price.amountMinor', quantity: 'tiers.1.minQuantity' },
  { price: 'tiers.2.price.amountMinor', quantity: 'tiers.2.minQuantity' },
] as const;

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

const translateRule = (ruleId: string): string => `Ошибка ${ruleId}`;

const mapToFilledRow = (fieldPath: string, values: PriceFormOutput): string => {
  const filledIndexes = values.tiers.flatMap((tier, index) => (tier.minQuantity === undefined ? [] : [index]));

  return fieldPath.replace(/^tiers\[(\d+)\]/u, (_match, position: string) => `tiers[${String(filledIndexes[Number(position)])}]`);
};

const findRowWithoutPrice = (values: PriceFormOutput): { field: string; ruleId: string }[] => values.tiers.flatMap(
  (tier, index) => (tier.minQuantity !== undefined && tier.price.amountMinor === undefined
    ? [{ field: ROW_PATHS[index]?.price ?? '', ruleId: 'price.required' }]
    : []),
);

interface PriceFormProps {
  execute: ExecuteValue;
  filled: TierInputValue[];
  isChecked?: boolean;
  isMapped?: boolean;
}

const PriceForm = ({ execute, filled, isChecked = false, isMapped = false }: PriceFormProps): ReactElement => {
  const { command, getFieldProps, handleSubmit } = useCommandForm<PriceFormValues, undefined, PriceFormOutput>({
    defaultValues: { tiers: createDefaultTiers(filled) },
    execute,
    mapViolationPath: isMapped ? mapToFilledRow : undefined,
    rules: RULES,
    translateViolation: translateRule,
    validateValues: isChecked ? findRowWithoutPrice : undefined,
  });

  return (
    <form noValidate onSubmit={handleSubmit}>
      {ROW_PATHS.map(row => (
        <fieldset key={row.price}>
          <TextField {...getFieldProps(row.quantity)} label={row.quantity} />
          <TextField {...getFieldProps(row.price)} label={row.price} />
        </fieldset>
      ))}
      <ActionButton access={{ status: 'allowed' }} command={command} type="submit">
        {SUBMIT_LABEL}
      </ActionButton>
    </form>
  );
};

const wrap = (props: PriceFormProps): ReactElement => withTestLocalizer(
  <LiveRegionProvider>
    <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
      <PriceForm {...props} />
    </QueryClientProvider>
  </LiveRegionProvider>,
);

const getInput = (name: string): HTMLInputElement => {
  const element = document.querySelector(`input[name="${name}"]`);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`The field ${name} is not an input`);
  }

  return element;
};

const pressSubmit = (): void => {
  act(() => {
    screen.getByRole('button', { name: SUBMIT_LABEL }).click();
  });
};

describe('useCommandForm with the check of the values', () => {
  afterEach(() => {
    cleanup();
  });

  it('puts the issue of the check under the field and does not call the command', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    render(wrap({ execute, filled: [createTier('1000', '')], isChecked: true }));

    pressSubmit();

    await waitFor(() => {
      expect(getInput('tiers.0.price.amountMinor').getAttribute('aria-invalid')).toBe('true');
    });
    expect(screen.getByText('Ошибка price.required')).toBeTruthy();
    expect(getInput('tiers.0.minQuantity').getAttribute('aria-invalid')).toBeNull();
    expect(execute).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: SUBMIT_LABEL }).getAttribute('aria-busy')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('uses the check of the latest render', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    const props = { execute, filled: [createTier('1000', '')] };
    const { rerender } = render(wrap(props));

    rerender(wrap({ ...props, isChecked: true }));
    pressSubmit();

    await waitFor(() => {
      expect(getInput('tiers.0.price.amountMinor').getAttribute('aria-invalid')).toBe('true');
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('sends the values when the check finds nothing', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve(undefined));
    render(wrap({ execute, filled: [createTier('1000', '8950')], isChecked: true }));

    pressSubmit();

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useCommandForm with a mapper of the paths of the server', () => {
  afterEach(() => {
    cleanup();
  });

  it('puts the violation under the field that the mapper picks with the submitted values', async () => {
    const execute = vi.fn<ExecuteValue>()
      .mockRejectedValueOnce(createValidationError([['tiers[0].price.amount_minor', 'tier.price_order']]));
    render(wrap({ execute, filled: [createTier('', ''), createTier('1000', '8950')], isMapped: true }));

    pressSubmit();

    await waitFor(() => {
      expect(getInput('tiers.1.price.amountMinor').getAttribute('aria-invalid')).toBe('true');
    });
    expect(screen.getByText('Ошибка tier.price_order')).toBeTruthy();
    expect(getInput('tiers.0.price.amountMinor').getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the paths of the server as they are without a mapper', async () => {
    const execute = vi.fn<ExecuteValue>()
      .mockRejectedValueOnce(createValidationError([['tiers[0].price.amount_minor', 'tier.price_order']]));
    render(wrap({ execute, filled: [createTier('', ''), createTier('1000', '8950')] }));

    pressSubmit();

    await waitFor(() => {
      expect(getInput('tiers.0.price.amountMinor').getAttribute('aria-invalid')).toBe('true');
    });
    expect(getInput('tiers.1.price.amountMinor').getAttribute('aria-invalid')).toBeNull();
  });
});
