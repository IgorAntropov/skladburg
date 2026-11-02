import type { Money } from '@skladburg/contracts/common/v1/money';

import { create } from '@bufbuild/protobuf';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatMoney } from './formatMoney';
import { RUB_CURRENCY_CODE } from './moneyConstants';

const createMoney = (amountMinor: bigint, currencyCode: string = RUB_CURRENCY_CODE): Money => create(
  MoneySchema,
  { amountMinor, currencyCode },
);

describe('formatMoney', () => {
  it.each([
    [5796000n, '57\u00a0960\u00a0₽'],
    [8900n, '89\u00a0₽'],
    [0n, '0\u00a0₽'],
    [8950n, '89,50\u00a0₽'],
    [8544n, '85,44\u00a0₽'],
    [5n, '0,05\u00a0₽'],
    [123456789n, '1\u00a0234\u00a0567,89\u00a0₽'],
    [50000000n, '500\u00a0000\u00a0₽'],
  ])('writes %s kopecks as "%s"', (amountMinor, expected) => {
    expect(formatMoney('ru', createMoney(amountMinor))).toBe(expected);
  });

  it('shows kopecks only when they are not zero', () => {
    expect(formatMoney('ru', createMoney(10000n))).not.toContain(',');
    expect(formatMoney('ru', createMoney(10001n))).toContain(',01');
  });

  it('keeps every digit of 5 * 10^18 kopecks', () => {
    expect(formatMoney('ru', createMoney(5000000000000000000n))).toBe('50\u00a0000\u00a0000\u00a0000\u00a0000\u00a0000\u00a0₽');
    expect(formatMoney('ru', createMoney(5000000000000000001n))).toBe('50\u00a0000\u00a0000\u00a0000\u00a0000\u00a0000,01\u00a0₽');
  });

  it('keeps every digit of the largest int64 amount', () => {
    expect(formatMoney('ru', createMoney(9223372036854775807n))).toBe('92\u00a0233\u00a0720\u00a0368\u00a0547\u00a0758,07\u00a0₽');
  });

  it('puts a minus sign in front of a negative amount', () => {
    expect(formatMoney('ru', createMoney(-8950n))).toBe('\u221289,50\u00a0₽');
    expect(formatMoney('ru', createMoney(-5n))).toBe('\u22120,05\u00a0₽');
  });

  it('follows the decimal separator of the locale', () => {
    expect(formatMoney('en', createMoney(8950n, 'USD'))).toBe('$89.50');
  });

  it('uses no fraction digits for a currency without minor units', () => {
    expect(formatMoney('en', createMoney(8950n, 'JPY'))).toBe('¥8,950');
  });
});
