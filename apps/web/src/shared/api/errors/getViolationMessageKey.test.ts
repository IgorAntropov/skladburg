import {
  describe,
  expect,
  it,
} from 'vitest';

import { getViolationMessageKey } from './getViolationMessageKey';

const CONTRACT_RULE_IDS = [
  'string.uuid',
  'string.uuid_empty',
  'string.min_len',
  'string.max_len',
  'string.pattern',
  'int32.gte_lte',
  'repeated.unique',
  'enum.not_in',
  'enum.defined_only',
  'required',
  'page_token.invalid',
];

describe('getViolationMessageKey', () => {
  it.each(CONTRACT_RULE_IDS)('gives the rule %s its own text', (ruleId) => {
    expect(getViolationMessageKey(ruleId)).toBe(`validation.${ruleId}`);
  });

  it.each([
    'headers.invalid',
    'string.email',
    '',
    'constructor',
    '__proto__',
    'toString',
  ])('uses the common text for the unknown rule "%s"', (ruleId) => {
    expect(getViolationMessageKey(ruleId)).toBe('validation.invalid');
  });
});
