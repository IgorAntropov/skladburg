import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  isCorrespondentAccountValid,
  isSettlementAccountValid,
} from './isBankAccountValid';

describe('isSettlementAccountValid', () => {
  it.each([
    ['040000777', '40702810700000000123'],
    ['040012345', '40702810500000000456'],
    ['040000501', '40702810300000000001'],
  ])('accepts the account of BIK %s with a correct key', (bik, account) => {
    expect(isSettlementAccountValid(bik, account)).toBe(true);
  });

  it.each([
    ['040000777', '40702810800000000123'],
    ['040000777', '40702810700000000124'],
    ['040000777', '40702811700000000123'],
    ['040000778', '40702810700000000123'],
    ['040012345', '40702810500000000457'],
    ['040000501', '40702810400000000001'],
    ['040000502', '40702810300000000001'],
  ])('rejects the account of BIK %s with one digit changed', (bik, account) => {
    expect(isSettlementAccountValid(bik, account)).toBe(false);
  });

  it.each(['', '4070281070000000012', '407028107000000001234', '4070281070000000012a', '40702810700000000123\n'])(
    'rejects the account %j by its length or characters',
    (account) => {
      expect(isSettlementAccountValid('040000777', account)).toBe(false);
    },
  );

  it.each(['', '04000077', '0400007777', '050000777', '04000077a'])('rejects any account for the malformed BIK %j', (bik) => {
    expect(isSettlementAccountValid(bik, '40702810700000000123')).toBe(false);
  });
});

describe('isCorrespondentAccountValid', () => {
  it.each([
    ['040000777', '30101810900000000777'],
    ['040012345', '30101810500000000345'],
    ['040000501', '30101810600000000501'],
  ])('accepts the account of BIK %s with a correct key', (bik, account) => {
    expect(isCorrespondentAccountValid(bik, account)).toBe(true);
  });

  it.each([
    ['040000777', '30101810800000000777'],
    ['040000777', '30101810900000000778'],
    ['040010777', '30101810900000000777'],
    ['040012345', '30101810500000000346'],
    ['040000501', '30101810700000000501'],
    ['040010501', '30101810600000000501'],
  ])('rejects the account of BIK %s with one digit changed', (bik, account) => {
    expect(isCorrespondentAccountValid(bik, account)).toBe(false);
  });

  it('uses another part of the BIK than the settlement account does', () => {
    expect(isCorrespondentAccountValid('040000777', '40702810700000000123')).toBe(false);
    expect(isSettlementAccountValid('040000777', '30101810900000000777')).toBe(false);
  });

  it.each(['', '3010181090000000077', '301018109000000007777', '3010181090000000077x'])(
    'rejects the account %j by its length or characters',
    (account) => {
      expect(isCorrespondentAccountValid('040000777', account)).toBe(false);
    },
  );
});
