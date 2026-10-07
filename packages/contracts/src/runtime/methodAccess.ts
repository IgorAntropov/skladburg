import type { DescMethod } from '@bufbuild/protobuf';

import {
  getOption,
  hasOption,
} from '@bufbuild/protobuf';

import {
  access,
  type MethodAccess,
} from '../gen/common/v1/method_options_pb';

export const getMethodAccess = (method: DescMethod): MethodAccess | undefined =>
  hasOption(method, access) ? getOption(method, access) : undefined;
