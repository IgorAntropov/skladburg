import {
  describe,
  expect,
  it,
} from 'vitest';

import type { FormRulesValue } from './formRuleTypes';

import { isFormFieldRequired } from './isFormFieldRequired';

const rules: FormRulesValue = {
  fields: {
    always: { ignore: 'always', isRequired: true, kind: 'string', protoName: 'always' },
    containsNonEmpty: { contains: 'x', kind: 'string', protoName: 'contains_non_empty' },
    ifZeroRequired: { ignore: 'ifZeroValue', isRequired: true, kind: 'string', protoName: 'if_zero_required' },
    ifZeroUuid: { ignore: 'ifZeroValue', isUuid: true, kind: 'string', protoName: 'if_zero_uuid' },
    integerMin: { gte: 1, kind: 'integer', protoName: 'integer_min', type: 'int32' },
    items: { kind: 'repeated', minItems: 1, protoName: 'items' },
    itemsMax: { kind: 'repeated', maxItems: 3, protoName: 'items_max' },
    lenOne: { kind: 'string', len: 1, protoName: 'len_one' },
    lenZero: { kind: 'string', len: 0, protoName: 'len_zero' },
    maxOnly: { kind: 'string', maxLen: 10, protoName: 'max_only' },
    minOne: { kind: 'string', minLen: 1, protoName: 'min_one' },
    minZero: { kind: 'string', minLen: 0, protoName: 'min_zero' },
    patternAllowsEmpty: { kind: 'string', pattern: '^([0-9]{9})?$', protoName: 'pattern_allows_empty' },
    patternBroken: { kind: 'string', pattern: '^(', protoName: 'pattern_broken' },
    patternForbidsEmpty: { kind: 'string', pattern: '^[0-9]{20}$', protoName: 'pattern_forbids_empty' },
    patternIfZero: { ignore: 'ifZeroValue', kind: 'string', pattern: '^[0-9]{20}$', protoName: 'pattern_if_zero' },
    patternPresence: { hasPresence: true, kind: 'string', pattern: '^[0-9]{20}$', protoName: 'pattern_presence' },
    plain: { kind: 'string', protoName: 'plain' },
    prefixEmpty: { kind: 'string', prefix: '', protoName: 'prefix_empty' },
    prefixNonEmpty: { kind: 'string', prefix: '04', protoName: 'prefix_non_empty' },
    presenceItems: { hasPresence: true, kind: 'repeated', minItems: 1, protoName: 'presence_items' },
    presenceMinOne: { hasPresence: true, kind: 'string', minLen: 1, protoName: 'presence_min_one' },
    presenceRequired: { hasPresence: true, isRequired: true, kind: 'string', minLen: 1, protoName: 'presence_required' },
    presenceUuid: { hasPresence: true, isUuid: true, kind: 'string', protoName: 'presence_uuid' },
    requiredEnum: { isRequired: true, kind: 'enum', protoName: 'required_enum' },
    serverOnlyRequired: { isRequired: true, isServerOnly: true, kind: 'opaque', protoName: 'server_only_required' },
    serverOnlyUuid: { isServerOnly: true, isUuid: true, kind: 'string', protoName: 'server_only_uuid' },
    suffixNonEmpty: { kind: 'string', protoName: 'suffix_non_empty', suffix: '.ru' },
    uuid: { isUuid: true, kind: 'string', protoName: 'uuid' },
  },
};

describe('isFormFieldRequired', () => {
  it('is true for required, a positive minimum, a positive exact length, uuid and a positive item minimum', () => {
    expect(isFormFieldRequired(rules, 'requiredEnum')).toBe(true);
    expect(isFormFieldRequired(rules, 'minOne')).toBe(true);
    expect(isFormFieldRequired(rules, 'lenOne')).toBe(true);
    expect(isFormFieldRequired(rules, 'uuid')).toBe(true);
    expect(isFormFieldRequired(rules, 'items')).toBe(true);
  });

  it('is false when an empty value is allowed', () => {
    expect(isFormFieldRequired(rules, 'plain')).toBe(false);
    expect(isFormFieldRequired(rules, 'minZero')).toBe(false);
    expect(isFormFieldRequired(rules, 'lenZero')).toBe(false);
    expect(isFormFieldRequired(rules, 'maxOnly')).toBe(false);
    expect(isFormFieldRequired(rules, 'itemsMax')).toBe(false);
    expect(isFormFieldRequired(rules, 'integerMin')).toBe(false);
  });

  it('is true when the pattern, prefix, suffix or contains rejects an empty string', () => {
    expect(isFormFieldRequired(rules, 'patternForbidsEmpty')).toBe(true);
    expect(isFormFieldRequired(rules, 'prefixNonEmpty')).toBe(true);
    expect(isFormFieldRequired(rules, 'suffixNonEmpty')).toBe(true);
    expect(isFormFieldRequired(rules, 'containsNonEmpty')).toBe(true);
  });

  it('is false when the pattern accepts an empty string, is not compilable or the prefix is empty', () => {
    expect(isFormFieldRequired(rules, 'patternAllowsEmpty')).toBe(false);
    expect(isFormFieldRequired(rules, 'patternBroken')).toBe(false);
    expect(isFormFieldRequired(rules, 'prefixEmpty')).toBe(false);
  });

  it('lets ifZeroValue and explicit presence skip the pattern of an empty value', () => {
    expect(isFormFieldRequired(rules, 'patternIfZero')).toBe(false);
    expect(isFormFieldRequired(rules, 'patternPresence')).toBe(false);
  });

  it('lets ifZeroValue allow an empty value but keeps explicit required', () => {
    expect(isFormFieldRequired(rules, 'ifZeroUuid')).toBe(false);
    expect(isFormFieldRequired(rules, 'ifZeroRequired')).toBe(true);
  });

  it('lets explicit presence skip an unset field unless required', () => {
    expect(isFormFieldRequired(rules, 'presenceMinOne')).toBe(false);
    expect(isFormFieldRequired(rules, 'presenceUuid')).toBe(false);
    expect(isFormFieldRequired(rules, 'presenceItems')).toBe(false);
    expect(isFormFieldRequired(rules, 'presenceRequired')).toBe(true);
  });

  it('is false when the field is ignored always', () => {
    expect(isFormFieldRequired(rules, 'always')).toBe(false);
  });

  it('reads server-only fields by the same signs', () => {
    expect(isFormFieldRequired(rules, 'serverOnlyRequired')).toBe(true);
    expect(isFormFieldRequired(rules, 'serverOnlyUuid')).toBe(true);
  });

  it('is false for unknown fields and inherited keys', () => {
    expect(isFormFieldRequired(rules, 'unknown')).toBe(false);
    expect(isFormFieldRequired(rules, 'constructor')).toBe(false);
  });
});
