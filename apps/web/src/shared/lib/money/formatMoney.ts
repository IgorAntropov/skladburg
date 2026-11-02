import type { Money } from '@skladburg/contracts/common/v1/money';

import type { LocaleCode } from '@/shared/i18n';

import { getMinorScale } from './getMinorScale';
import { MINUS_SIGN } from './moneyConstants';

interface MoneyFormatValue {
  decimalSeparator: string;
  fractionDigits: number;
  wholeFormat: Intl.NumberFormat;
}

const moneyFormats = new Map<string, MoneyFormatValue>();

const createMoneyFormat = (locale: LocaleCode, currencyCode: string): MoneyFormatValue => {
  const defaultFormat = new Intl.NumberFormat(locale, { currency: currencyCode, style: 'currency' });
  const fractionDigits = defaultFormat.resolvedOptions().maximumFractionDigits ?? 0;
  const sample = new Intl.NumberFormat(locale, {
    currency: currencyCode,
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: 'currency',
  }).formatToParts(1n);

  return {
    decimalSeparator: sample.find(part => part.type === 'decimal')?.value ?? ',',
    fractionDigits,
    wholeFormat: new Intl.NumberFormat(locale, {
      currency: currencyCode,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      style: 'currency',
    }),
  };
};

const getMoneyFormat = (locale: LocaleCode, currencyCode: string): MoneyFormatValue => {
  const key = `${locale}|${currencyCode}`;
  const cached = moneyFormats.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const created = createMoneyFormat(locale, currencyCode);
  moneyFormats.set(key, created);

  return created;
};

export const formatMoney = (locale: LocaleCode, money: Money): string => {
  const { decimalSeparator, fractionDigits, wholeFormat } = getMoneyFormat(locale, money.currencyCode);
  const isNegative = money.amountMinor < 0n;
  const absolute = isNegative ? -money.amountMinor : money.amountMinor;
  const scale = getMinorScale(fractionDigits);
  const fraction = absolute % scale;
  const parts = wholeFormat.formatToParts(absolute / scale);

  if (fraction !== 0n) {
    const lastIntegerIndex = parts.findLastIndex(part => part.type === 'integer');

    parts.splice(lastIntegerIndex + 1, 0, {
      type: 'decimal',
      value: `${decimalSeparator}${fraction.toString().padStart(fractionDigits, '0')}`,
    });
  }

  return `${isNegative ? MINUS_SIGN : ''}${parts.map(part => part.value).join('')}`;
};
