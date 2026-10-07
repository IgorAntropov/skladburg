import type {
  DescMessage,
  MessageShape,
} from '@bufbuild/protobuf';

import { pathToString } from '@bufbuild/protobuf/reflect';
import { createValidator } from '@bufbuild/protovalidate';

export interface ViolationValue {
  fieldPath: string;
  ruleId: string;
}

const validator = createValidator();

export const collectViolations = <Desc extends DescMessage>(
  schema: Desc,
  message: MessageShape<Desc>,
): ViolationValue[] => {
  const result = validator.validate(schema, message);

  if (result.kind === 'error') {
    throw result.error;
  }

  return (result.violations ?? []).map(violation => ({
    fieldPath: pathToString(violation.field),
    ruleId: violation.ruleId,
  }));
};
