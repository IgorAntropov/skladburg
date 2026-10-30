import {
  describe,
  expect,
  it,
} from 'vitest';

import { toFieldCheckKind } from './fieldCheckKinds';

describe('toFieldCheckKind', () => {
  it.each([
    ['FIELD_CHECK_INN', 'inn'],
    ['FIELD_CHECK_KPP', 'kpp'],
    ['FIELD_CHECK_OGRN', 'ogrn'],
    ['FIELD_CHECK_BIK', 'bik'],
    ['FIELD_CHECK_SETTLEMENT_ACCOUNT', 'settlementAccount'],
    ['FIELD_CHECK_CORRESPONDENT_ACCOUNT', 'correspondentAccount'],
    ['FIELD_CHECK_GTIN', 'gtin'],
  ])('turns the enum value %s into the kind %s', (name, kind) => {
    expect(toFieldCheckKind(name)).toBe(kind);
  });

  it.each(['FIELD_CHECK_UNSPECIFIED', 'FIELD_CHECK_PHONE_RU', 'INN', 'FIELD_CHECK_', '', 'field_check_inn'])(
    'knows no kind for %j',
    (name) => {
      expect(toFieldCheckKind(name)).toBeUndefined();
    },
  );
});
