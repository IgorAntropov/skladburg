import type {
  DescMessage,
  FileRegistry,
  MessageShape,
} from '@bufbuild/protobuf';

import { pathToString } from '@bufbuild/protobuf/reflect';
import { createValidator } from '@bufbuild/protovalidate';
import { getRuleSchema } from '@skladburg/contracts/registry';

import type {
  IDomainErrors,
  ViolationValue,
} from '../errors/index';

export interface IRequestValidator {
  collect: <TDesc extends DescMessage>(schema: TDesc, message: MessageShape<TDesc>) => ViolationValue[];
  validate: <TDesc extends DescMessage>(schema: TDesc, message: MessageShape<TDesc>) => void;
}

export const createRequestValidator = (errors: IDomainErrors, registry: FileRegistry): IRequestValidator => {
  const validator = createValidator();

  const collect = <TDesc extends DescMessage>(schema: TDesc, message: MessageShape<TDesc>): ViolationValue[] => {
    const result = validator.validate(getRuleSchema(registry, schema), message);

    if (result.kind === 'error') {
      throw errors.internal(result.error);
    }

    return (result.violations ?? []).map(violation => ({
      fieldPath: pathToString(violation.field),
      ruleId: violation.ruleId,
    }));
  };

  const validate = <TDesc extends DescMessage>(schema: TDesc, message: MessageShape<TDesc>): void => {
    const violations = collect(schema, message);

    if (violations.length > 0) {
      throw errors.validationFailed(violations);
    }
  };

  return { collect, validate };
};
