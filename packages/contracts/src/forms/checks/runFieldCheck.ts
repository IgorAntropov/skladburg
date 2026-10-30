import type { FormFieldCheckValue } from '../formRuleTypes';

import { getFieldCheckRuleId } from './getFieldCheckRuleId';
import {
  isCorrespondentAccountValid,
  isSettlementAccountValid,
} from './isBankAccountValid';
import { isBikValid } from './isBikValid';
import { isGtinValid } from './isGtinValid';
import { isInnValid } from './isInnValid';
import { isKppValid } from './isKppValid';
import { isOgrnValid } from './isOgrnValid';

const isValueAcceptable = (check: FormFieldCheckValue, value: string, peerValue: string | undefined): boolean => {
  switch (check.kind) {
    case 'bik':
      return isBikValid(value);
    case 'correspondentAccount':
      return peerValue === undefined || !isBikValid(peerValue) || isCorrespondentAccountValid(peerValue, value);
    case 'gtin':
      return isGtinValid(value);
    case 'inn':
      return isInnValid(value);
    case 'kpp':
      return isKppValid(value);
    case 'ogrn':
      return isOgrnValid(value);
    case 'settlementAccount':
      return peerValue === undefined || !isBikValid(peerValue) || isSettlementAccountValid(peerValue, value);
  }
};

export const runFieldCheck = (
  check: FormFieldCheckValue,
  value: string,
  peerValue: string | undefined,
): string | undefined => {
  if (value === '') {
    return undefined;
  }

  return isValueAcceptable(check, value, peerValue) ? undefined : getFieldCheckRuleId(check.kind);
};
