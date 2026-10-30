import type {
  DescField,
  DescMessage,
  Message,
} from '@bufbuild/protobuf';
import type {
  PathBuilder,
  ReflectMessage,
} from '@bufbuild/protobuf/reflect';

import {
  buildPath,
  isReflectMessage,
  pathToString,
  reflect,
} from '@bufbuild/protobuf/reflect';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';

import type { ViolationValue } from '../errors/index';

import { isCalendarDateExisting } from '../calendar/calendarDate';

export const CALENDAR_DATE_EXISTS_RULE_ID = 'calendar_date.exists';

type MapKeyValue = bigint | boolean | number | string;

const isMapKey = (value: unknown): value is MapKeyValue =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean';

const plans = new WeakMap<DescMessage, readonly DescField[]>();

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

const reachesCalendarDate = (message: DescMessage, visited: Set<string> = new Set()): boolean => {
  if (message.typeName === CalendarDateSchema.typeName) {
    return true;
  }

  if (visited.has(message.typeName)) {
    return false;
  }

  visited.add(message.typeName);

  return message.fields.some((field) => {
    const element = getElementMessage(field);

    return element !== undefined && reachesCalendarDate(element, visited);
  });
};

const getNestedFields = (message: DescMessage): readonly DescField[] => {
  const cached = plans.get(message);

  if (cached !== undefined) {
    return cached;
  }

  const nested = message.fields.filter((field) => {
    const element = getElementMessage(field);

    return element !== undefined && reachesCalendarDate(element);
  });

  plans.set(message, nested);

  return nested;
};

const readPart = (reflected: ReflectMessage, name: string): number => {
  const field = reflected.desc.fields.find(candidate => candidate.name === name);
  const value: unknown = field === undefined ? undefined : reflected.get(field);

  return typeof value === 'number' ? value : 0;
};

const isPathViolated = (pathText: string, skippedPaths: ReadonlySet<string>): boolean => {
  if (skippedPaths.has(pathText)) {
    return true;
  }

  const prefix = `${pathText}.`;

  for (const skippedPath of skippedPaths) {
    if (skippedPath.startsWith(prefix)) {
      return true;
    }
  }

  return false;
};

const checkDate = (
  reflected: ReflectMessage,
  path: PathBuilder,
  skippedPaths: ReadonlySet<string>,
  violations: ViolationValue[],
): void => {
  const pathText = pathToString(path.toPath());

  if (isPathViolated(pathText, skippedPaths)) {
    return;
  }

  const isExisting = isCalendarDateExisting({
    day: readPart(reflected, 'day'),
    month: readPart(reflected, 'month'),
    year: readPart(reflected, 'year'),
  });

  if (!isExisting) {
    violations.push({ fieldPath: pathText, ruleId: CALENDAR_DATE_EXISTS_RULE_ID });
  }
};

const walkMessage = (
  reflected: ReflectMessage,
  path: PathBuilder,
  skippedPaths: ReadonlySet<string>,
  violations: ViolationValue[],
): void => {
  if (reflected.desc.typeName === CalendarDateSchema.typeName) {
    checkDate(reflected, path, skippedPaths, violations);

    return;
  }

  for (const field of getNestedFields(reflected.desc)) {
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

export const collectCalendarDateViolations = (
  schema: DescMessage,
  message: Message,
  skippedPaths: ReadonlySet<string>,
): ViolationValue[] => {
  const violations: ViolationValue[] = [];

  walkMessage(reflect(schema, message), buildPath(schema), skippedPaths, violations);

  return violations;
};
