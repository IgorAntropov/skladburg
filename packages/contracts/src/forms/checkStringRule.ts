import type { FormStringRuleValue } from './formRuleTypes';

const compiledPatterns = new Map<string, RegExp | undefined>();

const matchesPattern = (source: string, value: string): boolean => {
  if (!compiledPatterns.has(source)) {
    try {
      compiledPatterns.set(source, new RegExp(source, 'u'));
    }
    catch {
      compiledPatterns.set(source, undefined);
    }
  }

  return compiledPatterns.get(source)?.test(value) ?? true;
};

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;

const countCodePoints = (value: string): number => {
  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    const nextUnit = value.charCodeAt(index + 1);
    const isSurrogatePair = unit >= HIGH_SURROGATE_START
      && unit <= HIGH_SURROGATE_END
      && nextUnit >= LOW_SURROGATE_START
      && nextUnit <= LOW_SURROGATE_END;

    if (isSurrogatePair) {
      index += 1;
    }

    count += 1;
  }

  return count;
};

export const checkStringRule = (rule: FormStringRuleValue, value: string): string[] => {
  const ruleIds: string[] = [];
  const length = countCodePoints(value);

  if (rule.len !== undefined && length !== rule.len) {
    ruleIds.push('string.len');
  }

  if (rule.minLen !== undefined && length < rule.minLen) {
    ruleIds.push('string.min_len');
  }

  if (rule.maxLen !== undefined && length > rule.maxLen) {
    ruleIds.push('string.max_len');
  }

  if (rule.pattern !== undefined && !matchesPattern(rule.pattern, value)) {
    ruleIds.push('string.pattern');
  }

  if (rule.prefix !== undefined && !value.startsWith(rule.prefix)) {
    ruleIds.push('string.prefix');
  }

  if (rule.suffix !== undefined && !value.endsWith(rule.suffix)) {
    ruleIds.push('string.suffix');
  }

  if (rule.contains !== undefined && !value.includes(rule.contains)) {
    ruleIds.push('string.contains');
  }

  if (rule.notContains !== undefined && value.includes(rule.notContains)) {
    ruleIds.push('string.not_contains');
  }

  if (rule.isUuid === true) {
    if (value === '') {
      ruleIds.push('string.uuid_empty');
    }
    else if (!UUID_PATTERN.test(value)) {
      ruleIds.push('string.uuid');
    }
  }

  return ruleIds;
};
