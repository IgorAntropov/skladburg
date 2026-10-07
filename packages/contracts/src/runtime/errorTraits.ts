import {
  create,
  type DescEnumValue,
  getOption,
  hasOption,
} from '@bufbuild/protobuf';

import {
  type ErrorCode,
  ErrorCodeSchema,
  type ErrorTraits,
  error_traits as errorTraitsOption,
  ErrorTraitsSchema,
} from '../gen/common/v1/error_pb';

const declaredValues: Partial<Record<number, DescEnumValue>> = ErrorCodeSchema.value;

export const getErrorTraits = (code: ErrorCode): ErrorTraits => {
  const value = declaredValues[code];

  return value && hasOption(value, errorTraitsOption)
    ? getOption(value, errorTraitsOption)
    : create(ErrorTraitsSchema);
};
