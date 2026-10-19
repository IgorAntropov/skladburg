import {
  type DescEnumValue,
  getOption,
  hasOption,
} from '@bufbuild/protobuf';

import {
  type PermissionCode,
  PermissionCodeSchema,
  type PermissionTraits,
  permission_traits as permissionTraitsOption,
} from '../gen/access/v1/permission_pb';

export const getPermissionTraits = (code: PermissionCode): PermissionTraits => {
  const declaredValues: Partial<Record<number, DescEnumValue>> = PermissionCodeSchema.value;
  const value = declaredValues[code];

  if (!value || !hasOption(value, permissionTraitsOption)) {
    throw new Error(`Permission code ${String(code)} has no permission traits`);
  }

  return getOption(value, permissionTraitsOption);
};
