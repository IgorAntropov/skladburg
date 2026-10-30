import type {
  DescField,
  DescMessage,
  Message,
} from '@bufbuild/protobuf';
import type {
  PathBuilder,
  ReflectMessage,
} from '@bufbuild/protobuf/reflect';
import type { FormFieldCheckValue } from '@skladburg/contracts/forms';

import {
  getOption,
  hasOption,
} from '@bufbuild/protobuf';
import {
  buildPath,
  isReflectMessage,
  pathToString,
  reflect,
} from '@bufbuild/protobuf/reflect';
import {
  field_check as fieldCheckExtension,
  FieldCheckSchema,
} from '@skladburg/contracts/common/v1/field_options';
import {
  runFieldCheck,
  toFieldCheckKind,
} from '@skladburg/contracts/forms';

import type { ViolationValue } from '../errors/index';

interface CheckedFieldValue {
  check: FormFieldCheckValue;
  field: ScalarFieldValue;
}

interface MessagePlanValue {
  bikField: ScalarFieldValue | undefined;
  checked: readonly CheckedFieldValue[];
  nested: readonly DescField[];
}

type ScalarFieldValue = DescField & { fieldKind: 'scalar' };

const ACCOUNT_KINDS: ReadonlySet<string> = new Set(['correspondentAccount', 'settlementAccount']);

type MapKeyValue = bigint | boolean | number | string;

const isMapKey = (value: unknown): value is MapKeyValue =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean';

const plans = new WeakMap<DescMessage, MessagePlanValue>();

const readFieldCheck = (field: DescField): FormFieldCheckValue | undefined => {
  if (field.fieldKind !== 'scalar' || !hasOption(field, fieldCheckExtension)) {
    return undefined;
  }

  const value: number = getOption(field, fieldCheckExtension);
  const kind = toFieldCheckKind(FieldCheckSchema.values.find(candidate => candidate.number === value)?.name ?? '');

  return kind === undefined ? undefined : { kind };
};

const getElementMessage = (field: DescField): DescMessage | undefined => {
  switch (field.fieldKind) {
    case 'list':
      return field.listKind === 'message' ? field.message : undefined;
    case 'map':
      return field.mapKind === 'message' ? field.message : undefined;
    case 'message':
      return field.message;
    default:
      return undefined;
  }
};

const reachesChecks = (message: DescMessage, visited: Set<string> = new Set()): boolean => {
  if (visited.has(message.typeName)) {
    return false;
  }

  visited.add(message.typeName);

  return message.fields.some((field) => {
    if (readFieldCheck(field) !== undefined) {
      return true;
    }

    const element = getElementMessage(field);

    return element !== undefined && reachesChecks(element, visited);
  });
};

const isNestedField = (field: DescField): boolean => {
  const element = getElementMessage(field);

  return element !== undefined && reachesChecks(element);
};

const buildPlan = (message: DescMessage): MessagePlanValue => {
  const checked: CheckedFieldValue[] = [];
  let bikField: ScalarFieldValue | undefined;

  for (const field of message.fields) {
    const check = readFieldCheck(field);

    if (check === undefined || field.fieldKind !== 'scalar') {
      continue;
    }

    if (check.kind === 'bik') {
      bikField ??= field;
    }

    checked.push({ check, field });
  }

  return { bikField, checked, nested: message.fields.filter(isNestedField) };
};

const getPlan = (message: DescMessage): MessagePlanValue => {
  const cached = plans.get(message);

  if (cached !== undefined) {
    return cached;
  }

  const plan = buildPlan(message);

  plans.set(message, plan);

  return plan;
};

const readText = (reflected: ReflectMessage, field: ScalarFieldValue): string => {
  const value: unknown = reflected.get(field);

  return typeof value === 'string' ? value : '';
};

const toPathText = (path: PathBuilder, field: DescField): string => pathToString(path.clone().field(field).toPath());

const collectOwnViolations = (
  reflected: ReflectMessage,
  path: PathBuilder,
  skippedPaths: ReadonlySet<string>,
  violations: ViolationValue[],
): void => {
  const plan = getPlan(reflected.desc);
  const { bikField } = plan;
  const bikValue = bikField === undefined ? '' : readText(reflected, bikField);
  const bikCheck: FormFieldCheckValue = { kind: 'bik' };
  const isBikUsable = bikField !== undefined
    && bikValue !== ''
    && !skippedPaths.has(toPathText(path, bikField))
    && runFieldCheck(bikCheck, bikValue, undefined) === undefined;

  for (const { check, field } of plan.checked) {
    const value = readText(reflected, field);
    const fieldPath = toPathText(path, field);
    const isAccount = ACCOUNT_KINDS.has(check.kind);

    if (value === '' || skippedPaths.has(fieldPath) || (isAccount && !isBikUsable)) {
      continue;
    }

    const ruleId = runFieldCheck(check, value, isAccount ? bikValue : undefined);

    if (ruleId !== undefined) {
      violations.push({ fieldPath, ruleId });
    }
  }
};

const walkMessage = (
  reflected: ReflectMessage,
  path: PathBuilder,
  skippedPaths: ReadonlySet<string>,
  violations: ViolationValue[],
): void => {
  collectOwnViolations(reflected, path, skippedPaths, violations);

  for (const field of getPlan(reflected.desc).nested) {
    if (field.fieldKind === 'message') {
      const value: unknown = reflected.get(field);

      if (reflected.isSet(field) && isReflectMessage(value)) {
        walkMessage(value, path.clone().field(field), skippedPaths, violations);
      }

      continue;
    }

    if (field.fieldKind === 'list' && field.listKind === 'message') {
      const list = reflected.get(field);

      for (let index = 0; index < list.size; index += 1) {
        const item = list.get(index);

        if (isReflectMessage(item)) {
          walkMessage(item, path.clone().field(field).list(index), skippedPaths, violations);
        }
      }

      continue;
    }

    if (field.fieldKind === 'map' && field.mapKind === 'message') {
      for (const [key, item] of reflected.get(field)) {
        if (isMapKey(key) && isReflectMessage(item)) {
          walkMessage(item, path.clone().field(field).map(key), skippedPaths, violations);
        }
      }
    }
  }
};

export const collectFieldCheckViolations = (
  schema: DescMessage,
  message: Message,
  skippedPaths: ReadonlySet<string>,
): ViolationValue[] => {
  const violations: ViolationValue[] = [];

  walkMessage(reflect(schema, message), buildPath(schema), skippedPaths, violations);

  return violations;
};
