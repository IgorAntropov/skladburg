import {
  describe,
  expect,
  it,
} from 'vitest';

import { runFieldCheck } from './runFieldCheck';

describe('runFieldCheck', () => {
  it('answers nothing for a correct value and the rule id for a wrong one', () => {
    expect(runFieldCheck({ kind: 'inn' }, '0000000018', undefined)).toBeUndefined();
    expect(runFieldCheck({ kind: 'inn' }, '0000000019', undefined)).toBe('field_check.inn');
    expect(runFieldCheck({ kind: 'kpp' }, '000001001', undefined)).toBeUndefined();
    expect(runFieldCheck({ kind: 'kpp' }, '0000A1001', undefined)).toBeUndefined();
    expect(runFieldCheck({ kind: 'kpp' }, '00000a001', undefined)).toBe('field_check.kpp');
    expect(runFieldCheck({ kind: 'kpp' }, '000001A01', undefined)).toBe('field_check.kpp');
    expect(runFieldCheck({ kind: 'ogrn' }, '1020000123450', undefined)).toBeUndefined();
    expect(runFieldCheck({ kind: 'ogrn' }, '1020000123451', undefined)).toBe('field_check.ogrn');
    expect(runFieldCheck({ kind: 'bik' }, '040000777', undefined)).toBeUndefined();
    expect(runFieldCheck({ kind: 'bik' }, '050000777', undefined)).toBe('field_check.bik');
  });

  it.each(['inn', 'kpp', 'ogrn', 'bik', 'settlementAccount', 'correspondentAccount'] as const)(
    'does not check an empty value of %s',
    (kind) => {
      expect(runFieldCheck({ kind }, '', '040000777')).toBeUndefined();
    },
  );

  it('checks a settlement account against the BIK of the neighbour', () => {
    const check = { kind: 'settlementAccount', peerField: 'bik' } as const;

    expect(runFieldCheck(check, '40702810700000000123', '040000777')).toBeUndefined();
    expect(runFieldCheck(check, '40702810800000000123', '040000777')).toBe('field_check.settlement_account');
    expect(runFieldCheck(check, '40702810700000000123', '040000778')).toBe('field_check.settlement_account');
  });

  it('checks a correspondent account against the BIK of the neighbour', () => {
    const check = { kind: 'correspondentAccount', peerField: 'bik' } as const;

    expect(runFieldCheck(check, '30101810900000000777', '040000777')).toBeUndefined();
    expect(runFieldCheck(check, '30101810800000000777', '040000777')).toBe('field_check.correspondent_account');
  });

  it.each([undefined, '', '04000077', '050000777'])('skips an account when the BIK is %j', (peerValue) => {
    expect(runFieldCheck({ kind: 'settlementAccount', peerField: 'bik' }, '40702810800000000123', peerValue)).toBeUndefined();
    expect(runFieldCheck({ kind: 'correspondentAccount', peerField: 'bik' }, '30101810800000000777', peerValue)).toBeUndefined();
  });
});
