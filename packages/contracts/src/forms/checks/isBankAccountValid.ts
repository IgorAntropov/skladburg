import { isBikValid } from './isBikValid';

const ACCOUNT_PATTERN = /^[0-9]{20}$/;
const KEY_WEIGHTS: readonly number[] = [7, 1, 3];
const DECIMAL_BASE = 10;
const BIK_SETTLEMENT_PREFIX_START = 6;
const BIK_CORRESPONDENT_PREFIX_START = 4;
const BIK_CORRESPONDENT_PREFIX_END = 6;

const isAccountKeyValid = (prefix: string, account: string): boolean => {
  if (!ACCOUNT_PATTERN.test(account)) {
    return false;
  }

  const sum = Array.from(`${prefix}${account}`, Number).reduce(
    (total, digit, position) => total + ((digit * (KEY_WEIGHTS[position % KEY_WEIGHTS.length] ?? 0)) % DECIMAL_BASE),
    0,
  );

  return sum % DECIMAL_BASE === 0;
};

export const isSettlementAccountValid = (bik: string, account: string): boolean =>
  isBikValid(bik) && isAccountKeyValid(bik.slice(BIK_SETTLEMENT_PREFIX_START), account);

export const isCorrespondentAccountValid = (bik: string, account: string): boolean =>
  isBikValid(bik)
  && isAccountKeyValid(`0${bik.slice(BIK_CORRESPONDENT_PREFIX_START, BIK_CORRESPONDENT_PREFIX_END)}`, account);
