import { hasGs1CheckDigit } from './hasGs1CheckDigit';

const GTIN_PATTERN = /^(?:[0-9]{8}|[0-9]{12,14})$/;

export const isGtinValid = (value: string): boolean => GTIN_PATTERN.test(value) && hasGs1CheckDigit(value);
